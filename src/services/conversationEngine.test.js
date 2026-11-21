import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BLAME_TARGETS, DEPARTMENTS } from "../constants/departments";
import { sendChatMessage } from "./chatService";
import { deriveTopic, detectIntent, planTurn, routeNext } from "./conversationEngine";
import { APOLOGY_LINE } from "./offlineReplies";
import { REPLY_POOLS, fillTemplate } from "./replyPools";

const dept = (id) => DEPARTMENTS.find((d) => d.id === id);
const EXAM = "I have an exam tomorrow. Can you help me study?";

describe("detectIntent", () => {
  it.each([
    [EXAM, "exam"],
    ["Yes, I am a student.", "exam"],
    ["What time is it?", "time"],
    ["How do I fix my Wi-Fi?", "wifi"],
    ["I want a refund", "billing"],
    ["Where do I submit the form?", "paperwork"],
    ["my printer is on fire", "tech"],
    ["Hello there", "greeting"],
    ["Okay.", "ack"],
    ["Yes, I am a human.", "ack"],
    ["WHAT?", "upset"],
    ["this is useless", "upset"],
    ["can I speak to a manager", "human"],
    ["the sky is green", "other"],
    ["", "other"],
  ])("%j -> %s", (text, intent) => {
    expect(detectIntent(text)).toBe(intent);
  });

  it("does not treat a confirmation as a request for a human", () => {
    expect(detectIntent("Yes, I am a human.")).not.toBe("human");
  });
});

describe("routeNext", () => {
  it("walks the exam demo: intake -> verifier -> supervisor -> cio", () => {
    expect(routeNext("intake", "exam")).toBe("verifier");
    expect(routeNext("verifier", "ack")).toBe("supervisor");
    expect(routeNext("supervisor", "exam")).toBe("cio"); // "Yes, I am a student." must not jump backwards
    expect(routeNext("cio", "upset")).toBe("form_ai");
  });

  it("jumps from the front desk to the matching department", () => {
    expect(routeNext("intake", "wifi")).toBe("excuse_ai");
    expect(routeNext("intake", "time")).toBe("verifier");
    expect(routeNext("intake", "billing")).toBe("cio");
    expect(routeNext("intake", "paperwork")).toBe("form_ai");
  });

  it("escalates a request for a human to the CEO, who bounces it to the front desk", () => {
    expect(routeNext("supervisor", "human")).toBe("ceo");
    expect(routeNext("ceo", "human")).toBe("intake");
    expect(routeNext("ceo", "other")).toBe("intake");
  });

  it("never routes a ticket to the department it is already in", () => {
    const intents = ["human", "exam", "time", "wifi", "billing", "paperwork", "tech", "ack", "upset", "other"];
    for (const { id } of DEPARTMENTS) {
      for (const intent of intents) expect(routeNext(id, intent)).not.toBe(id);
    }
  });

  it("visits every department before returning to the front desk", () => {
    const seen = [];
    let at = "intake";
    for (let i = 0; i < DEPARTMENTS.length; i++) {
      at = routeNext(at, "other");
      seen.push(at);
    }
    expect(new Set(seen).size).toBe(DEPARTMENTS.length);
    expect(at).toBe("intake");
  });

  it("recovers from an unknown department", () => {
    expect(routeNext("nope", "other")).toBe("verifier");
  });
});

describe("deriveTopic", () => {
  it("labels recognisable topics", () => {
    expect(deriveTopic(EXAM)).toBe("your exam");
    expect(deriveTopic("What time is it?")).toBe("the time");
  });

  it("quotes unrecognised questions in the customer's words", () => {
    expect(deriveTopic("my printer is on fire!")).toBe('"my printer is on fire"');
  });

  it("recalls the earlier question when the message is just 'Okay.' or 'WHAT?'", () => {
    const history = [{ sender: "user", text: EXAM }, { sender: "ai", text: "Welcome!", deptId: "verifier" }];
    expect(deriveTopic("Okay.", history)).toBe("your exam");
    expect(deriveTopic("WHAT?", history)).toBe("your exam");
  });

  it("keeps the original topic through follow-ups like 'no really it is on fire'", () => {
    const history = [{ sender: "user", text: "my printer is on fire" }];
    expect(deriveTopic("no really it is on fire", history)).toBe('"my printer is on fire"');
  });

  it("does not mistake 'No one answers my calls' for a confirmation", () => {
    expect(detectIntent("No one answers my calls")).not.toBe("ack");
    expect(deriveTopic("No one answers my calls")).toBe('"No one answers my calls"');
  });

  it("shortens long messages on a word boundary", () => {
    const original = "my printer keeps printing the same page forever and nobody here can stop it at all";
    const topic = deriveTopic(original);
    expect(topic.startsWith('"') && topic.endsWith('…"')).toBe(true);
    expect(topic.length).toBeLessThanOrEqual(52);
    const kept = topic.slice(1, -2); // strip the opening quote and the trailing …"
    expect(original.startsWith(kept)).toBe(true);
    expect(original[kept.length]).toBe(" "); // cut between words, never mid-word
  });

  it("falls back to a generic topic", () => {
    expect(deriveTopic("Okay.")).toBe("your concern");
    expect(deriveTopic("")).toBe("your concern");
  });
});

describe("planTurn", () => {
  it("is deterministic", () => {
    const a = planTurn({ userText: EXAM, currentDept: dept("intake") });
    const b = planTurn({ userText: EXAM, currentDept: dept("intake") });
    expect(a).toEqual(b);
  });

  it("answers the three advertised starters with their own department, not the apology", () => {
    const exam = planTurn({ userText: EXAM, currentDept: dept("intake") });
    const wifi = planTurn({ userText: "How do I fix my Wi-Fi?", currentDept: dept("intake") });
    const time = planTurn({ userText: "What time is it?", currentDept: dept("intake") });
    expect([exam.dept.id, wifi.dept.id, time.dept.id]).toEqual(["verifier", "excuse_ai", "verifier"]);
    for (const plan of [exam, wifi, time]) expect(plan.reply).not.toBe(APOLOGY_LINE);
    expect(exam.reply).toMatch(/student/i);
    expect(wifi.reply).toMatch(/wi-?fi|internet/i);
    expect(time.reply).toMatch(/time/i);
  });

  it("does not repeat the line a department just said", () => {
    const first = planTurn({ userText: "hmm", currentDept: dept("supervisor") });
    expect(first.dept.id).toBe("cio");
    const again = planTurn({
      userText: "hmm",
      currentDept: dept("supervisor"),
      history: [{ sender: "ai", deptId: "cio", text: first.reply }],
    });
    expect(again.reply).not.toBe(first.reply);
  });

  it("repeats nothing back to back across many identical messages", () => {
    const history = [];
    let current = dept("supervisor");
    let previous = null;
    for (let i = 0; i < 12; i++) {
      const plan = planTurn({ userText: "hmm", currentDept: current, history });
      expect(plan.reply).not.toBe(previous);
      previous = plan.reply;
      history.push({ sender: "user", text: "hmm" }, { sender: "ai", deptId: plan.dept.id, text: plan.reply });
      current = plan.dept;
    }
  });

  it("suggests the next step of the demo", () => {
    expect(planTurn({ userText: EXAM, currentDept: dept("intake") }).suggestedQuickReply.value).toBe(
      "Yes, I am a student.",
    );
    expect(planTurn({ userText: "Okay.", currentDept: dept("verifier") }).suggestedQuickReply.value).toBe("WHAT?");
    expect(planTurn({ userText: "WHAT?", currentDept: dept("supervisor") }).suggestedQuickReply.value).toMatch(
      /JUST ANSWER MY QUESTION/,
    );
    expect(planTurn({ userText: "x y z", currentDept: dept("excuse_ai") }).suggestedQuickReply).toBeNull();
  });

  it("only blames targets that exist in BLAME_TARGETS (they are translated by exact string)", () => {
    for (const { id } of DEPARTMENTS) {
      for (const userText of ["x", "fix my wifi", EXAM, "WHAT?", "talk to a manager"]) {
        expect(BLAME_TARGETS).toContain(planTurn({ userText, currentDept: dept(id) }).blame);
      }
    }
  });

  it("survives missing and malformed input", () => {
    expect(() => planTurn()).not.toThrow();
    expect(() => planTurn({ userText: null, currentDept: null, history: "nope" })).not.toThrow();
    expect(() => planTurn({ userText: "hi", history: [null, undefined, {}, { sender: "ai" }, 5] })).not.toThrow();
    expect(planTurn().reply.length).toBeGreaterThan(0);
  });
});

describe("reply pools", () => {
  it("only reference departments, intents-as-keys and placeholders that can be filled", () => {
    const ids = new Set(DEPARTMENTS.map((d) => d.id));
    for (const [deptId, pool] of Object.entries(REPLY_POOLS)) {
      expect(ids.has(deptId)).toBe(true);
      expect(pool.default?.length).toBeGreaterThan(0);
      for (const templates of Object.values(pool)) {
        for (const template of templates) {
          const text = fillTemplate(template, { topic: "your exam" });
          expect(text).not.toMatch(/[{}]/);
          expect(text).not.toMatch(/(?:^|[.!?]\s)[a-z]/); // every sentence starts with a capital
        }
      }
    }
    expect([...ids].every((id) => REPLY_POOLS[id])).toBe(true);
  });

  it("capitalises a placeholder that starts a sentence, and only then", () => {
    expect(fillTemplate("Hi! {topic} is escalated.", { topic: "your exam" })).toBe("Hi! Your exam is escalated.");
    expect(fillTemplate("{topic} is escalated.", { topic: "your exam" })).toBe("Your exam is escalated.");
    expect(fillTemplate("Please confirm {topic}.", { topic: "your exam" })).toBe("Please confirm your exam.");
    expect(fillTemplate("About {topic}", { topic: '"my printer"' })).toBe('About "my printer"');
    expect(fillTemplate("{other} stays", { topic: "x" })).toBe("{other} stays");
  });
});

describe("sendChatMessage with no backend and no API key", () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("no longer answers every message with the same apology (regression)", async () => {
    // Exactly what the Vite dev proxy returns when nothing is listening on :8000.
    const fetchMock = vi.fn(async () => json({ status: "offline", error: "ECONNREFUSED" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    const inputs = [EXAM, "Okay.", "Yes, I am a student.", "WHAT?", "How do I fix my Wi-Fi?", "What time is it?"];
    const history = [];
    let current = dept("intake");
    const replies = [];
    const departments = [];

    for (const text of inputs) {
      const res = await sendChatMessage(text, current, history);
      replies.push(res.reply);
      departments.push(res.departmentId);
      history.push(
        { sender: "user", text },
        { sender: "ai", deptId: res.departmentId, text: res.reply },
      );
      current = dept(res.departmentId);
    }

    expect(departments.slice(0, 3)).toEqual(["verifier", "supervisor", "cio"]);
    expect(new Set(departments).size).toBeGreaterThanOrEqual(5);
    expect(new Set(replies).size).toBe(replies.length);
    expect(replies.filter((r) => r === APOLOGY_LINE).length).toBeLessThanOrEqual(1);
    // One /api/chat and one /api/gemini attempt per message: the 503 is not retried.
    expect(fetchMock).toHaveBeenCalledTimes(inputs.length * 2);
  });

  it("uses the backend's answer when there is one, and fills in what it leaves out", async () => {
    vi.stubGlobal("fetch", async (url) =>
      String(url).endsWith("/api/chat") ? json({ reply: "From the server" }) : json({}, 404),
    );
    const res = await sendChatMessage(EXAM, dept("intake"), []);
    expect(res.reply).toBe("From the server");
    expect(res.departmentId).toBe("verifier"); // routing still comes from the engine
    expect(BLAME_TARGETS).toContain(res.blame);
  });

  it("lets the backend decide the department when it names one", async () => {
    vi.stubGlobal("fetch", async () => json({ reply: "Forms!", departmentId: "form_ai" }));
    const res = await sendChatMessage(EXAM, dept("intake"), []);
    expect(res.departmentId).toBe("form_ai");
  });

  it("uses live LLM text for the department the engine routed to", async () => {
    vi.stubGlobal("fetch", async (url) =>
      String(url).endsWith("/api/gemini")
        ? json({ candidates: [{ content: { parts: [{ text: "  Hello from Gemini!  " }] } }] })
        : json({}, 404),
    );
    const res = await sendChatMessage("What time is it?", dept("intake"), []);
    expect(res.reply).toBe("Hello from Gemini!");
    expect(res.departmentId).toBe("verifier");
  });
});
