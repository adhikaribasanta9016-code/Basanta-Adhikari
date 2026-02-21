/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Send, Moon, Sun, Sparkles, MessageSquare, Calendar, LayoutDashboard, ChevronRight, Info, RefreshCw, Mic, MicOff, Volume2, VolumeX, UserPlus, X, Menu } from 'lucide-react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    webkitSpeechRecognition: any;
  }
}

// Initialize Gemini API
const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const RASHI_LIST = [
  { name: "मेष (Aries)", icon: "♈", status: "शुभ फल", color: "text-red-500", bg: "bg-red-500/10" },
  { name: "वृष (Taurus)", icon: "♉", status: "सामान्य", color: "text-orange-500", bg: "bg-orange-500/10" },
  { name: "मिथुन (Gemini)", icon: "♊", status: "आर्थिक लाभ", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { name: "कर्कट (Cancer)", icon: "♋", status: "यात्रा योग", color: "text-blue-500", bg: "bg-blue-500/10" },
  { name: "सिंह (Leo)", icon: "♌", status: "कार्य सिद्धि", color: "text-amber-500", bg: "bg-amber-500/10" },
  { name: "कन्या (Virgo)", icon: "♍", status: "सामान्य", color: "text-green-500", bg: "bg-green-500/10" },
  { name: "तुला (Libra)", icon: "♎", status: "पारिवारिक सुख", color: "text-pink-500", bg: "bg-pink-500/10" },
  { name: "वृश्चिक (Scorpio)", icon: "♏", status: "स्वास्थ्य लाभ", color: "text-purple-500", bg: "bg-purple-500/10" },
  { name: "धनु (Sagittarius)", icon: "♐", status: "शुभ समाचार", color: "text-indigo-500", bg: "bg-indigo-500/10" },
  { name: "मकर (Capricorn)", icon: "♑", status: "व्यवसाय वृद्धि", color: "text-slate-500", bg: "bg-slate-500/10" },
  { name: "कुम्भ (Aquarius)", icon: "♒", status: "सामान्य", color: "text-cyan-500", bg: "bg-cyan-500/10" },
  { name: "मीन (Pisces)", icon: "♓", status: "आध्यात्मिक लाभ", color: "text-emerald-500", bg: "bg-emerald-500/10" },
];

const getNepaliDate = () => {
  const months = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कात्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत"];
  const days = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];
  const now = new Date();
  // Simplified BS conversion for demo (approximate)
  const bsYear = now.getFullYear() + 56;
  const bsMonth = months[10]; // Feb is usually Falgun
  const bsDay = 9; // Feb 20 is approx Falgun 9
  const dayName = days[now.getDay()];
  
  const toNepaliNum = (num: number | string) => {
    const map: any = { '0': '०', '1': '१', '2': '२', '3': '३', '4': '४', '5': '५', '6': '६', '7': '७', '8': '८', '9': '९' };
    return String(num).split('').map(d => map[d] || d).join('');
  };

  return `${dayName}, ${toNepaliNum(bsDay)} ${bsMonth} ${toNepaliNum(bsYear)}`;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: "नमस्ते! म तपाईँको वैदिक एआई सहायक 'ज्योतिषी बाजे' हुँ। तपाईँको व्यक्तिगत राशिफल र ग्रह दशाको सही गणना गर्नका लागि, कृपया पहिले तपाईँको **पूरा नाम** भन्नुहोस्।",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRashi, setSelectedRashi] = useState<string | null>(null);
  const [rashiDetail, setRashiDetail] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check for API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected || !!process.env.GEMINI_API_KEY);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: "API Key अपडेट भयो! अब तपाईँ सोधपुछ सुरु गर्न सक्नुहुन्छ।",
        timestamp: new Date()
      }]);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [userProfile, setUserProfile] = useState<{ name: string; dob: string } | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<'name' | 'dob' | 'ready'>('name');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', email: '', phone: '' });
  const [regStatus, setRegStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      // Stop ongoing speech
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsSpeaking(false);
      }

      const SpeechRecognition = window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'ne-NP'; // Nepali

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          handleSendMessage(transcript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert("तपाईँको ब्राउजरले भ्वाइस रिकग्निसन सपोर्ट गर्दैन।");
      }
    }
  };

  const speakResponse = async (text: string) => {
    if (isMuted) return;
    try {
      setIsSpeaking(true);
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say in a wise, elderly Nepali voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
          audioRef.current.onended = () => setIsSpeaking(false);
        }
      }
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const ai = getAIClient();
      
      // Onboarding Logic
      if (onboardingStep === 'name') {
        const name = textToSend.trim();
        setUserProfile({ name, dob: "" });
        setOnboardingStep('dob');
        
        const msg = `धन्यवाद ${name} ज्यू! अब कृपया तपाईँको **जन्म मिति (Date of Birth)** भन्नुहोस् (जस्तै: २०५०-०१-०१) ताकि म तपाईँको ग्रह र नक्षत्रको सही गणना गर्न सकूँ।`;
        setMessages(prev => [...prev, {
          role: 'ai',
          content: msg,
          timestamp: new Date()
        }]);
        speakResponse(msg.replace(/\*\*/g, ''));
        setIsLoading(false);
        return;
      }

      if (onboardingStep === 'dob') {
        const dob = textToSend.trim();
        setUserProfile(prev => prev ? { ...prev, dob } : { name: "Unknown", dob });
        setOnboardingStep('ready');
        
        const msg = `उत्कृष्ट! अब म तपाईँको विवरण सुरक्षित गरेको छु। तपाईँको जन्म मिति ${dob} को आधारमा म अब तपाईँलाई व्यक्तिगत ज्योतिषीय परामर्श दिन तयार छु। तपाईँ के जान्न चाहनुहुन्छ?`;
        setMessages(prev => [...prev, {
          role: 'ai',
          content: msg,
          timestamp: new Date()
        }]);
        speakResponse(msg);
        setIsLoading(false);
        return;
      }

      // Normal Chatting with Profile Context
      const profileContext = userProfile 
        ? `प्रयोगकर्ताको विवरण: नाम: ${userProfile.name}, जन्म मिति: ${userProfile.dob}। ` 
        : "";

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: textToSend,
        config: {
          systemInstruction: `${profileContext}तपाईँ एक अनुभवी वैदिक ज्योतिषी हुनुहुन्छ। तपाईँको नाम 'ज्योतिषी बाजे' हो। तपाईँले प्रयोगकर्ताको नाम र जन्म मितिको आधारमा उनीहरूको ग्रह दशा र भविष्यको बारेमा सल्लाह दिनुहुन्छ। सधैँ विनम्र र आध्यात्मिक भाषा प्रयोग गर्नुहोस्।`,
        }
      });

      const aiResponse: Message = {
        role: 'ai',
        content: response.text || "माफ गर्नुहोस्, अहिले मैले जवाफ दिन सकिन।",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);
      if (response.text) {
        speakResponse(response.text);
      }
    } catch (error: any) {
      console.error("Gemini Error:", error);
      let friendlyError = "सर्भरमा केही समस्या आयो।";
      
      if (error.message?.includes("quota")) {
        friendlyError = "तपाईँको API कोटा सकिएको छ। कृपया अर्को Key छनोट गर्नुहोस्।";
      }

      const errorMessage: Message = {
        role: 'ai',
        content: friendlyError,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRashiClick = async (rashiName: string) => {
    setSelectedRashi(rashiName);
    setRashiDetail("गणना हुँदैछ...");
    
    try {
      const ai = getAIClient();
      const profileContext = userProfile 
        ? `प्रयोगकर्ताको विवरण: नाम: ${userProfile.name}, जन्म मिति: ${userProfile.dob}। ` 
        : "";

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${rashiName} राशिको आजको विस्तृत राशिफल नेपालीमा भन्नुहोस्।`,
        config: {
          systemInstruction: `${profileContext}तपाईँ एक अनुभवी वैदिक ज्योतिषी हुनुहुन्छ। राशिफल बताउँदा प्रयोगकर्ताको नाम र जन्म मितिको आधारमा उनीहरूको ग्रह दशा र भविष्यको बारेमा संक्षिप्त तर स्पष्ट जानकारी दिनुहोस्।`,
        }
      });
      setRashiDetail(response.text || "विवरण प्राप्त गर्न सकिएन।");
      if (response.text) {
        speakResponse(response.text);
      }
    } catch (error) {
      setRashiDetail("विवरण प्राप्त गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।");
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setRegStatus(null);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });
      const data = await response.json();
      if (response.ok) {
        setRegStatus({ type: 'success', msg: 'पञ्जीकरण सफल भयो! हामी तपाईँलाई चाँडै सम्पर्क गर्नेछौं।' });
        setTimeout(() => setShowRegisterModal(false), 3000);
      } else {
        setRegStatus({ type: 'error', msg: data.error || 'केही समस्या आयो।' });
      }
    } catch (error) {
      setRegStatus({ type: 'error', msg: 'सर्भरसँग सम्पर्क हुन सकेन।' });
    }
  };

  const closeRashiModal = () => {
    setSelectedRashi(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#121214]/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-600/20">
                <Sparkles className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-amber-400">
                  Vedic AI Assistant
                </h1>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{getNepaliDate()}</span>
                  <span className="w-1 h-1 bg-slate-600 rounded-full" />
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Online</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 uppercase font-bold">सुनको दर (Gold)</span>
                <span className="text-xs font-bold text-amber-500">Rs. १,५२,३००</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 uppercase font-bold">चाँदी (Silver)</span>
                <span className="text-xs font-bold text-slate-300">Rs. १,८५०</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400 mr-4">
              <button className="hover:text-orange-500 transition-colors flex items-center gap-2">
                <Calendar className="w-4 h-4" /> पात्रो
              </button>
              <button className="hover:text-orange-500 transition-colors flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> राशिफल
              </button>
            </div>
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-orange-500 transition-all"
              title={isMuted ? "Unmute AI" : "Mute AI"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className={`w-5 h-5 ${isSpeaking ? 'text-orange-500 animate-bounce' : ''}`} />}
            </button>
            <button 
              onClick={() => setShowRegisterModal(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-600/20"
            >
              <UserPlus className="w-4 h-4" /> Register
            </button>
            <button 
              onClick={handleSelectKey}
              className={`p-2 rounded-xl border transition-all ${
                hasKey ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-orange-600/20 border-orange-500 text-orange-500 animate-bounce'
              }`}
              title="Select API Key"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 lg:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-80px)] lg:h-[calc(100vh-120px)]">
        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="fixed inset-0 z-[60] bg-[#0a0a0c] lg:hidden overflow-y-auto p-6 pt-24"
            >
              <div className="space-y-8">
                {/* Gold Rates Mobile */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">सुनको दर</span>
                    <span className="text-sm font-bold text-amber-500">Rs. १,५२,३००</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">चाँदीको दर</span>
                    <span className="text-sm font-bold text-slate-300">Rs. १,८५०</span>
                  </div>
                </div>

                {/* Panchang Mobile */}
                <div className="bg-gradient-to-br from-orange-600/20 to-amber-500/10 rounded-3xl border border-orange-500/20 p-6">
                  <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> आजको पञ्चाङ्ग
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">तिथि</span>
                      <span className="text-xs font-bold text-slate-200">शुक्ल नवमी</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">नक्षत्र</span>
                      <span className="text-xs font-bold text-slate-200">रोहिणी</span>
                    </div>
                  </div>
                </div>

                {/* Register Mobile */}
                <button 
                  onClick={() => { setShowRegisterModal(true); setShowMobileMenu(false); }}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg"
                >
                  <UserPlus className="w-5 h-5" /> Register Now
                </button>

                {/* Rashi List Mobile */}
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-orange-500 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" /> दैनिक राशिफल
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {RASHI_LIST.map((rashi) => (
                      <button
                        key={rashi.name}
                        onClick={() => { handleRashiClick(rashi.name); setShowMobileMenu(false); }}
                        className={`flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-orange-500/30 transition-all text-left`}
                      >
                        <span className="text-2xl">{rashi.icon}</span>
                        <span className="text-xs font-bold text-slate-300">{rashi.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar - Rashi List (Desktop) */}
        <aside className="lg:col-span-3 overflow-y-auto pr-2 custom-scrollbar hidden lg:block space-y-6">
          {/* Daily Panchang Card */}
          <div className="bg-gradient-to-br from-orange-600/20 to-amber-500/10 rounded-3xl border border-orange-500/20 p-6">
            <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> आजको पञ्चाङ्ग
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-bold uppercase">तिथि</span>
                <span className="text-xs font-bold text-slate-200">शुक्ल नवमी</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-bold uppercase">नक्षत्र</span>
                <span className="text-xs font-bold text-slate-200">रोहिणी</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-bold uppercase">सूर्योदय</span>
                <span className="text-xs font-bold text-slate-200">०६:४२ AM</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-bold uppercase">सूर्यास्त</span>
                <span className="text-xs font-bold text-slate-200">०५:५८ PM</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-orange-500/10">
              <p className="text-[10px] italic text-orange-400/80 leading-relaxed">
                "शुभ कर्मको लागि आजको दिन उत्तम छ।"
              </p>
            </div>
          </div>

          <div className="bg-[#121214] rounded-3xl border border-white/5 p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-orange-500">
              <Sparkles className="w-5 h-5" /> दैनिक राशिफल
            </h2>
            <div className="space-y-3">
              {RASHI_LIST.map((rashi) => (
                <motion.button
                  key={rashi.name}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRashiClick(rashi.name)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border ${
                    selectedRashi === rashi.name 
                    ? 'bg-orange-600/20 border-orange-500/50' 
                    : 'bg-white/5 border-transparent hover:border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl ${rashi.color}`}>{rashi.icon}</span>
                    <span className="text-sm font-medium text-slate-300">{rashi.name.split(' ')[0]}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </motion.button>
              ))}
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <section className="lg:col-span-9 flex flex-col bg-[#121214] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl relative">
          {/* Daily Quote Banner */}
          <div className="bg-gradient-to-r from-orange-600/10 via-amber-500/5 to-transparent px-8 py-3 border-b border-white/5 flex items-center gap-3">
            <Info className="w-4 h-4 text-orange-500" />
            <p className="text-[11px] font-medium text-slate-400">
              <span className="text-orange-500 font-bold uppercase mr-2">आजको विचार:</span>
              "सत्य र धर्मको बाटोमा हिड्ने मानिस कहिल्यै पराजित हुँदैन।"
            </p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                      msg.role === 'user' ? 'bg-slate-700 text-slate-300' : 'bg-orange-600 text-white'
                    }`}>
                      {msg.role === 'user' ? 'ME' : 'JB'}
                    </div>
                    <div className={`p-4 rounded-2xl text-[15px] leading-relaxed ${
                      msg.role === 'user' 
                      ? 'bg-orange-600 text-white rounded-tr-none' 
                      : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/5'
                    }`}>
                      {msg.content}
                      <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 items-center text-orange-500/60 text-xs font-bold uppercase tracking-widest animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  ज्योतिषी बाजे गणना गर्दै हुनुहुन्छ...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-black/20 border-t border-white/5">
            <div className="relative flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="आफ्नो जिज्ञासा यहाँ लेख्नुहोस्..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-orange-600/50 focus:ring-1 focus:ring-orange-600/50 transition-all text-slate-200 placeholder:text-slate-600"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleListening}
                className={`p-4 rounded-2xl transition-all shadow-lg ${
                  isListening 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:text-orange-500'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSendMessage()}
                disabled={isLoading || !input.trim()}
                className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600 text-white p-4 rounded-2xl transition-colors shadow-lg shadow-orange-600/20"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["आजको राशिफल", "शुभ साइत", "विवाह योग", "करियर सल्लाह"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSendMessage(suggestion)}
                  className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-slate-500 hover:text-orange-500"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Rashi Detail Modal */}
      <AnimatePresence>
        {selectedRashi && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#121214] border border-orange-900/30 rounded-[2.5rem] max-w-lg w-full p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-600 to-transparent" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <span className="text-5xl">{RASHI_LIST.find(r => r.name === selectedRashi)?.icon}</span>
                  <div>
                    <h2 className="text-3xl font-black text-orange-500">{selectedRashi.split(' ')[0]}</h2>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">आजको विस्तृत राशिफल</p>
                  </div>
                </div>
                <button 
                  onClick={closeRashiModal}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <ChevronRight className="w-6 h-6 rotate-90 text-slate-500" />
                </button>
              </div>

              <div className="bg-black/20 rounded-3xl p-6 border border-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                <div className="text-slate-300 leading-relaxed whitespace-pre-wrap text-lg">
                  {rashiDetail}
                </div>
              </div>

              <button
                onClick={closeRashiModal}
                className="w-full mt-8 bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-orange-600/20"
              >
                बन्द गर्नुहोस्
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registration Modal */}
      <AnimatePresence>
        {showRegisterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#121214] border border-white/10 rounded-[2.5rem] max-w-md w-full p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowRegisterModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-slate-500"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-orange-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="text-orange-500 w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white">नयाँ खाता खोल्नुहोस्</h2>
                <p className="text-slate-500 text-sm mt-2">हाम्रो विशेष अफर र राशिफल अपडेटहरू प्राप्त गर्नुहोस्।</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">पूरा नाम</label>
                  <input 
                    type="text" 
                    required
                    value={regForm.name}
                    onChange={(e) => setRegForm({...regForm, name: e.target.value})}
                    placeholder="तपाईँको नाम"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-orange-600/50 transition-all text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">इमेल ठेगाना</label>
                  <input 
                    type="email" 
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm({...regForm, email: e.target.value})}
                    placeholder="example@mail.com"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-orange-600/50 transition-all text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">फोन नम्बर (वैकल्पिक)</label>
                  <input 
                    type="tel" 
                    value={regForm.phone}
                    onChange={(e) => setRegForm({...regForm, phone: e.target.value})}
                    placeholder="९८XXXXXXXX"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-orange-600/50 transition-all text-slate-200"
                  />
                </div>

                {regStatus && (
                  <div className={`p-4 rounded-2xl text-xs font-bold ${regStatus.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {regStatus.msg}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-orange-600/20 mt-4"
                >
                  दर्ता गर्नुहोस्
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} className="hidden" />
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
