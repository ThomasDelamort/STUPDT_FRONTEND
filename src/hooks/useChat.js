import { useState, useRef, useEffect, useCallback } from "react";
import { DEPARTMENTS, BLAME_TARGETS } from "../constants";
import { sendChatMessage } from "../services/chatService";
import { useStuPDT } from "../contexts/useStuPDT";

const INITIAL_MESSAGES = [
  {
    id: "welcome-1",
    sender: "ai",
    deptId: "intake",
    deptName: "StuPDT Assistant #001",
    deptRole: "Frontline Referral Specialist",
    deptBadge: "DEPT #001",
    text: "Welcome to StuPDT! Ask any everyday question below—or tap a quick starter button—and watch our 17 specialized AI departments work tirelessly to accomplish absolutely nothing.",
    confidence: "99.97%",
    accuracy: "CLASSIFIED",
    blame: "None Yet (Give Us 4 Seconds)",
    timestamp: "Just now",
  },
];

const CHAT_STORAGE_KEY = "stupdt_chat_history";

// How many recent messages the reply engine sees. Long enough that "Okay." and "WHAT?" can still
// be traced back to the question that started the conversation.
const HISTORY_WINDOW = 8;

function loadStoredMessages() {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(
          (m) => m && typeof m === "object" && typeof m.text === "string" && m.id,
        );
        if (valid.length > 0) return valid;
      }
    }
  } catch {
    // SessionStorage restricted
  }
  return INITIAL_MESSAGES;
}

export function useChat() {
  const { soundFX, bumpMetrics, isPremiumVIP, setActiveModal } = useStuPDT();

  const [activeDeptId, setActiveDeptId] = useState("intake");
  const [inputValue, setInputValue] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [messages, setMessages] = useState(loadStoredMessages);

  // Sync messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage quota or restriction
    }
  }, [messages]);

  const [suggestedQuickReply, setSuggestedQuickReply] = useState({
    label: 'Try Exam Demo: "I have an exam tomorrow. Can you help me study?"',
    value: "I have an exam tomorrow. Can you help me study?",
  });

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTransferring]);

  const clearChatHistory = useCallback(() => {
    setMessages(INITIAL_MESSAGES);
    setActiveDeptId("intake");
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const performDepartmentTransfer = useCallback(
    (nextDept, responseMessageText, customBlame, postCallback) => {
      // Captured now, while it is still the department the customer is leaving. (Reading it
      // from a state updater after setActiveDeptId(nextDept.id) always yielded the NEW dept,
      // so every banner read "Transferred: X -> X".)
      const prevDeptName = DEPARTMENTS.find((d) => d.id === activeDeptId)?.name || "Intake Desk";

      setIsTransferring(true);
      setTransferTarget(nextDept);
      soundFX.playTransferHold();

      setTimeout(() => {
        setIsTransferring(false);
        setActiveDeptId(nextDept.id);
        soundFX.playChime();

        // Built outside any state updater: updaters must be pure, and StrictMode runs them twice.
        const newAiMsg = {
          id: `ai-${Date.now()}-${Math.random()}`,
          sender: "ai",
          deptId: nextDept.id,
          deptName: nextDept.name,
          deptRole: nextDept.role,
          deptBadge: nextDept.badge,
          transferredFrom: prevDeptName,
          text: responseMessageText,
          confidence: isPremiumVIP ? "99.999% VIP" : "99.97%",
          accuracy: "CLASSIFIED",
          blame: customBlame || BLAME_TARGETS[Math.floor(Math.random() * BLAME_TARGETS.length)],
          timestamp: "Just now",
        };
        setMessages((prev) => [...prev, newAiMsg]);

        if (postCallback) postCallback();
      }, 1050);
    },
    [soundFX, isPremiumVIP, activeDeptId],
  );

  const handleSendMessage = useCallback(
    async (overrideText) => {
      const textToSend = (overrideText !== undefined ? overrideText : inputValue).trim();
      if (!textToSend || isTransferring) return;

      setInputValue("");
      setSuggestedQuickReply(null);

      const userMsg = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: textToSend,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, userMsg]);

      // Grand Finale Trigger
      if (
        textToSend.toUpperCase().includes("PLEASE JUST ANSWER") ||
        textToSend.toUpperCase().includes("JUST ANSWER MY QUESTION") ||
        textToSend.toUpperCase().includes("JUST ANSWER ME")
      ) {
        bumpMetrics(2, 45, 14);
        soundFX.playKlaxon();
        setActiveModal("grand_finale");
        return;
      }

      // Dynamic backend chat dispatch - all responses and referrals handled server-side
      bumpMetrics(1, 18, 7);
      const currentIndex = DEPARTMENTS.findIndex((d) => d.id === activeDeptId);
      const targetDept = DEPARTMENTS[currentIndex >= 0 ? currentIndex : 0];

      setIsTransferring(true);
      setTransferTarget(targetDept);

      const chatData = await sendChatMessage(
        textToSend,
        targetDept,
        messages.slice(-HISTORY_WINDOW),
      );

      const nextDept = DEPARTMENTS.find((d) => d.id === chatData.departmentId) || {
        id: chatData.departmentId || "intake",
        name: chatData.departmentName || "StuPDT Assistant #001",
        role: chatData.departmentRole || "Frontline Referral Specialist",
        badge: chatData.departmentBadge || "DEPT #001",
        accent: "#0EC7F5",
      };

      performDepartmentTransfer(nextDept, chatData.reply, chatData.blame, () => {
        if (chatData.suggestedQuickReply) {
          setSuggestedQuickReply(chatData.suggestedQuickReply);
        } else {
          setSuggestedQuickReply({
            label: 'Fed up? Click: "StuPDT, PLEASE JUST ANSWER MY QUESTION."',
            value: "StuPDT, PLEASE JUST ANSWER MY QUESTION.",
          });
        }
      });
    },
    [
      inputValue,
      isTransferring,
      activeDeptId,
      bumpMetrics,
      soundFX,
      setActiveModal,
      messages,
      performDepartmentTransfer,
    ],
  );

  const addAiMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return {
    activeDeptId,
    setActiveDeptId,
    messages,
    addAiMessage,
    clearChatHistory,
    inputValue,
    setInputValue,
    isTransferring,
    transferTarget,
    suggestedQuickReply,
    chatEndRef,
    performDepartmentTransfer,
    handleSendMessage,
  };
}
