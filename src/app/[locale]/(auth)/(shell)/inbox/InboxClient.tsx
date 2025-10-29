"use client";

import React, { useEffect, useState } from "react";
import { Conversation, Message, type ConversationItem, type MessageItem } from "@/libs/base44";
import { Search, Mail, MessageSquare, Instagram, Facebook, Youtube, Linkedin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const platformIcons: Record<
  string,
  { icon: React.ComponentType<any>; color: string }
> = {
  instagram: { icon: Instagram, color: "text-pink-500" },
  twitter: { icon: XIcon, color: "text-gray-800" },
  facebook: { icon: Facebook, color: "text-blue-600" },
  linkedin: { icon: Linkedin, color: "text-sky-700" },
  youtube: { icon: Youtube, color: "text-red-600" },
  tiktok: { icon: TikTokIcon, color: "text-black" },
  threads: { icon: MessageSquare, color: "text-neutral-900" },
  email: { icon: Mail, color: "text-gray-500" },
};

function ConversationItemRow({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: ConversationItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { icon: Icon, color } = platformIcons[conversation.platform] || {
    icon: MessageSquare,
    color: "text-gray-500",
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-start p-3 gap-3 cursor-pointer transition-colors duration-200 border-r-4 ${
        isSelected ? "bg-pink-50 border-pink-500" : "border-transparent hover:bg-gray-50"
      }`}
    >
      <div className="relative shrink-0">
        <img src={conversation.contact_avatar} alt={conversation.contact_name} className="w-10 h-10 rounded-full" />
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-sm text-gray-800 truncate">{conversation.contact_name}</p>
          <p className="text-xs text-gray-400 shrink-0">
            {new Date(conversation.last_message_timestamp).toLocaleDateString()}
          </p>
        </div>
        <p className="text-sm text-gray-500 truncate">{conversation.last_message_snippet}</p>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: MessageItem }) {
  const isOutgoing = message.is_outgoing;
  return (
    <div className={`flex items-end gap-2 my-2 ${isOutgoing ? "justify-end" : "justify-start"}`}>
      {!isOutgoing && (
        <img src={message.sender_avatar} alt={message.sender_name} className="w-8 h-8 rounded-full" />
      )}
      <div
        className={`max-w-md px-4 py-2 rounded-2xl ${
          isOutgoing ? "bg-pink-500 text-white rounded-br-none" : "bg-gray-100 text-gray-800 rounded-bl-none"
        }`}
      >
        <p>{message.content}</p>
        <p className={`text-xs mt-1 ${isOutgoing ? "text-pink-100" : "text-gray-400"}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {isOutgoing && <img src={message.sender_avatar} alt={message.sender_name} className="w-8 h-8 rounded-full" />}
    </div>
  );
}

function ChatView({
  conversation,
  messages,
  onSendMessage,
}: {
  conversation: ConversationItem | null;
  messages: MessageItem[];
  onSendMessage: (content: string) => void;
}) {
  const [newMessage, setNewMessage] = useState("");

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
        <div className="text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">בחר שיחה כדי להתחיל</p>
        </div>
      </div>
    );
  }

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage("");
    }
  };

  const PlatformIcon = platformIcons[conversation.platform]?.icon;

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{conversation.contact_name}</h2>
          <p className="text-sm text-gray-500 capitalize flex items-center">
            {PlatformIcon && <PlatformIcon className="w-4 h-4 inline mr-1" />} {conversation.type.replace("_", " ")}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ChatMessage message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="relative">
          <Input
            placeholder="כתוב הודעה..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="pr-12"
          />
          <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={handleSend}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InboxClient(): React.ReactElement {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [filter, setFilter] = useState<"unresolved" | "unread" | "all">("unread");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      const convos = await Conversation.list("-last_message_timestamp");
      setConversations(convos);
      if (convos.length > 0) void handleSelectConversation(convos[0]);
      setIsLoading(false);
    })();
  }, []);

  const handleSelectConversation = async (conversation: ConversationItem) => {
    setSelectedConversation(conversation);
    const msgs = await Message.filter({ conversation_id: conversation.id }, "timestamp");
    setMessages(msgs);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedConversation) return;
    const user = { full_name: "אריאל", avatar: "https://i.pravatar.cc/150?u=user" };
    const newMessage: Omit<MessageItem, "id"> = {
      conversation_id: selectedConversation.id,
      sender_name: user.full_name,
      sender_avatar: user.avatar,
      content,
      timestamp: new Date().toISOString(),
      is_outgoing: true,
    } as Omit<MessageItem, "id">;
    const created = await Message.create(newMessage);
    setMessages((prev) => [...prev, created]);
    await Conversation.update(selectedConversation.id, {
      last_message_snippet: content,
      last_message_timestamp: new Date().toISOString(),
    });
  };

  const filteredConversations = conversations
    .filter((c) => filter === "all" || c.status === filter)
    .filter((c) => c.contact_name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-full flex bg-gray-100 overflow-hidden">
      <div className="w-[350px] shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input placeholder="Search conversation..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant={filter === "unresolved" ? "default" : "outline"} onClick={() => setFilter("unresolved")}>Unresolved</Button>
            <Button variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")}>Unread</Button>
            <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-center text-gray-500">טוען שיחות...</p>
          ) : (
            filteredConversations.map((convo) => (
              <ConversationItemRow
                key={convo.id}
                conversation={convo}
                isSelected={selectedConversation?.id === convo.id}
                onClick={() => void handleSelectConversation(convo)}
              />
            ))
          )}
        </div>
      </div>

      <ChatView conversation={selectedConversation} messages={messages} onSendMessage={handleSendMessage} />
    </div>
  );
}


