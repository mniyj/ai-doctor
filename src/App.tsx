/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Menu,
  Trash2,
  LayoutGrid,
  VolumeX,
  MoreHorizontal,
  RefreshCw,
  ChevronUp,
  Hash,
  ChevronRight,
  Stethoscope,
  Phone,
  Camera,
  Hospital,
  Plus,
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  Search,
  MapPin,
  Star,
  Clock,
  Filter,
  ArrowLeft,
  Activity,
  Heart,
  Video,
  Calendar,
  Map,
  Navigation,
  Compass,
  X,
  Send,
  Loader2,
  Key,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReactNode, useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { chatWithGeminiStream, analyzeImageStream, Message as GeminiMessage } from './services/geminiService';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Language = 'zh-CN' | 'zh-TW' | 'en';

interface UsageRecord {
  date: string;
  description: Record<Language, string>;
  amount: Record<Language, string>;
}

interface Benefit {
  id: string;
  icon: ReactNode;
  name: Record<Language, string>;
  total: number;
  used: number;
  validUntil: string;
  records: UsageRecord[];
}

const mockBenefits: Benefit[] = [
  {
    id: '1',
    icon: <Stethoscope className="w-5 h-5" />,
    name: { 'zh-CN': '在线问诊', 'zh-TW': '在線問診', 'en': 'Online Consultation' },
    total: 12,
    used: 8,
    validUntil: '2026-12-31',
    records: [
      {
        date: '2026-03-15',
        description: { 'zh-CN': '在线问诊 - 消化内科', 'zh-TW': '在線問診 - 消化內科', 'en': 'Online Consultation - Gastroenterology' },
        amount: { 'zh-CN': '消耗1次', 'zh-TW': '消耗1次', 'en': 'Used 1 time' }
      },
      {
        date: '2026-02-20',
        description: { 'zh-CN': '在线问诊 - 皮肤科', 'zh-TW': '在線問診 - 皮膚科', 'en': 'Online Consultation - Dermatology' },
        amount: { 'zh-CN': '消耗1次', 'zh-TW': '消耗1次', 'en': 'Used 1 time' }
      },
    ]
  },
  {
    id: '2',
    icon: <Hospital className="w-5 h-5" />,
    name: { 'zh-CN': '线下门诊预约', 'zh-TW': '線下門診預約', 'en': 'Outpatient Booking' },
    total: 5,
    used: 4,
    validUntil: '2026-04-25',
    records: [
      {
        date: '2026-03-01',
        description: { 'zh-CN': '门诊预约 - 牙科', 'zh-TW': '門診預約 - 牙科', 'en': 'Outpatient Booking - Dental' },
        amount: { 'zh-CN': '消耗1次', 'zh-TW': '消耗1次', 'en': 'Used 1 time' }
      },
    ]
  },
  {
    id: '3',
    icon: <ShieldCheck className="w-5 h-5" />,
    name: { 'zh-CN': '高端体检', 'zh-TW': '高端體檢', 'en': 'Premium Checkup' },
    total: 1,
    used: 1,
    validUntil: '2026-06-30',
    records: [
      {
        date: '2026-01-10',
        description: { 'zh-CN': '年度体检', 'zh-TW': '年度體檢', 'en': 'Annual Checkup' },
        amount: { 'zh-CN': '消耗1次', 'zh-TW': '消耗1次', 'en': 'Used 1 time' }
      },
    ]
  },
  {
    id: '4',
    icon: <Activity className="w-5 h-5" />,
    name: { 'zh-CN': '健康测评', 'zh-TW': '健康測評', 'en': 'Health Assessment' },
    total: 10,
    used: 2,
    validUntil: '2026-05-15',
    records: []
  },
  {
    id: '5',
    icon: <Heart className="w-5 h-5" />,
    name: { 'zh-CN': '心理咨询', 'zh-TW': '心理諮詢', 'en': 'Mental Health' },
    total: 3,
    used: 0,
    validUntil: '2026-04-15',
    records: []
  }
];

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  disclaimer?: string;
  image?: string;
  isStreaming?: boolean;
  triage?: {
    level: 'self_care' | 'suggest_online' | 'visit_hospital';
    reason: string;
    department: string;
  };
  benefitStatus?: string; // Deprecated, use benefitStatuses
  benefitStatuses?: string[]; // IDs of the benefits to show status for
  suggestions?: string[];
}

interface Doctor {
  id: string;
  name: Record<Language, string>;
  specialty: Record<Language, string>;
  hospital: Record<Language, string>;
  tier: '3A' | 'central' | 'private';
  rating: number;
  reviews: number;
  experience: number;
  matchScore?: number;
  avatarColor: string;
  initials: string;
  supportsVideo: boolean;
  scores: {
    professional: number;
    service: number;
    experience: number;
    outcome: number;
  };
  reviewsList: {
    id: string;
    rating: number;
    text: string;
    time: string;
  }[];
  availableSlots: {
    date: string;
    label: string;
    slots: { time: string; available: boolean }[];
  }[];
}

const mockDoctors: Doctor[] = [
  {
    id: 'd1',
    name: { 'zh-CN': '陈医生', 'zh-TW': '陳醫生', 'en': 'Dr. Chen' },
    specialty: { 'zh-CN': '全科', 'zh-TW': '全科', 'en': 'GP' },
    hospital: { 'zh-CN': '玛丽医院', 'zh-TW': '瑪麗醫院', 'en': 'Queen Mary Hospital' },
    tier: '3A',
    rating: 4.9,
    reviews: 128,
    experience: 15,
    matchScore: 92,
    avatarColor: 'bg-blue-500',
    initials: 'C',
    supportsVideo: true,
    scores: { professional: 4.9, service: 4.8, experience: 4.7, outcome: 4.9 },
    reviewsList: [
      { id: 'r1', rating: 5, text: '陈医生非常专业，讲解很详细，态度也很好。', time: '2小时前' },
      { id: 'r2', rating: 5, text: '非常有耐心的医生，给出的建议很实用。', time: '昨天' },
      { id: 'r3', rating: 4, text: '医术高明，就是排队时间有点长。', time: '3天前' }
    ],
    availableSlots: [
      { date: '2026-04-09', label: '今天 Today', slots: [{ time: '09:00', available: false }, { time: '09:30', available: true }, { time: '10:00', available: true }] },
      { date: '2026-04-10', label: '明天 Tomorrow', slots: [{ time: '09:00', available: true }, { time: '09:30', available: true }, { time: '10:00', available: false }] },
      { date: '2026-04-11', label: '4/11(五)', slots: [{ time: '09:00', available: true }, { time: '09:30', available: true }, { time: '10:00', available: true }] }
    ]
  },
  {
    id: 'd2',
    name: { 'zh-CN': '李医生', 'zh-TW': '李醫生', 'en': 'Dr. Li' },
    specialty: { 'zh-CN': '牙科', 'zh-TW': '牙科', 'en': 'Dental' },
    hospital: { 'zh-CN': '养和医院', 'zh-TW': '養和醫院', 'en': 'HKSH' },
    tier: 'private',
    rating: 4.8,
    reviews: 85,
    experience: 10,
    avatarColor: 'bg-emerald-500',
    initials: 'L',
    supportsVideo: false,
    scores: { professional: 4.7, service: 4.9, experience: 4.8, outcome: 4.7 },
    reviewsList: [
      { id: 'r4', rating: 5, text: '李医生补牙技术一流，一点都不疼。', time: '1小时前' },
      { id: 'r5', rating: 5, text: '环境很好，医生很温柔。', time: '2天前' },
      { id: 'r6', rating: 4, text: '挺好的，就是价格略贵。', time: '1周前' }
    ],
    availableSlots: [
      { date: '2026-04-09', label: '今天 Today', slots: [{ time: '14:00', available: true }, { time: '14:30', available: false }, { time: '15:00', available: true }] },
      { date: '2026-04-10', label: '明天 Tomorrow', slots: [{ time: '14:00', available: true }, { time: '14:30', available: true }, { time: '15:00', available: true }] }
    ]
  },
  {
    id: 'd3',
    name: { 'zh-CN': '张医生', 'zh-TW': '張醫生', 'en': 'Dr. Zhang' },
    specialty: { 'zh-CN': '消化科', 'zh-TW': '消化科', 'en': 'Gastro' },
    hospital: { 'zh-CN': '威尔斯亲王医院', 'zh-TW': '威爾斯親王醫院', 'en': 'Prince of Wales' },
    tier: '3A',
    rating: 4.7,
    reviews: 210,
    experience: 20,
    matchScore: 88,
    avatarColor: 'bg-purple-500',
    initials: 'Z',
    supportsVideo: true,
    scores: { professional: 4.8, service: 4.5, experience: 4.6, outcome: 4.8 },
    reviewsList: [
      { id: 'r7', rating: 5, text: '老专家了，看病很准。', time: '30分钟前' },
      { id: 'r8', rating: 4, text: '态度一般，但水平确实高。', time: '昨天' },
      { id: 'r9', rating: 5, text: '推荐给有肠胃问题的朋友。', time: '5天前' }
    ],
    availableSlots: [
      { date: '2026-04-09', label: '今天 Today', slots: [{ time: '10:00', available: true }, { time: '10:30', available: true }, { time: '11:00', available: false }] },
      { date: '2026-04-10', label: '明天 Tomorrow', slots: [{ time: '10:00', available: false }, { time: '10:30', available: true }, { time: '11:00', available: true }] }
    ]
  }
];

interface Institution {
  id: number;
  name: Record<Language, string>;
  address: Record<Language, string>;
  type: 'public' | 'private' | 'chain';
  availability: 'today' | 'tomorrow' | '3days' | '7days' | '15days' | '30days' | 'anytime';
  tags: (keyof typeof translations['zh-CN']['tags'])[];
  distance: number;
  rating: number;
  image: string;
  hasElectronicReport: boolean;
  phone: string;
  hours: string;
  reviewsCount: number;
  coords: { x: number; y: number };
  reviews: {
    id: string;
    user: string;
    rating: number;
    date: string;
    text: string;
    tags: string[];
  }[];
}

const mockInstitutions: Institution[] = [
  {
    id: 1,
    name: {
      'zh-CN': '香港医疗中心',
      'zh-TW': '香港醫療中心',
      'en': 'Hong Kong Medical Center'
    },
    address: {
      'zh-CN': '香港中环德辅道中10号',
      'zh-TW': '香港中環德輔道中10號',
      'en': '10 Des Voeux Road Central, Hong Kong'
    },
    type: 'private',
    availability: 'tomorrow',
    tags: ['medical', 'private', 'report'],
    distance: 1.2,
    rating: 4.5,
    image: 'https://picsum.photos/seed/hksh/200/150',
    hasElectronicReport: true,
    phone: '+852 2801 1234',
    hours: '09:00-18:00',
    reviewsCount: 128,
    coords: { x: 45, y: 55 },
    reviews: [
      { id: 'r1', user: '张先生', rating: 5, date: '2026-03-05', text: '医生非常专业，解释详细清晰，等候时间短，是我见过最好的全科医生之一！强烈推荐。', tags: ['态度好', '专业', '等候短'] },
      { id: 'r2', user: 'Mary L.', rating: 5, date: '2026-02-20', text: 'Very professional and thorough. The doctor explained my condition clearly and the waiting time was reasonable. Will definitely come back.', tags: ['Professional', 'Friendly', 'Thorough'] }
    ]
  },
  {
    id: 2,
    name: {
      'zh-CN': '尖沙咀牙科诊所',
      'zh-TW': '尖沙咀牙科診所',
      'en': 'TST Dental Clinic'
    },
    address: {
      'zh-CN': '九龙尖沙咀弥敦道132号',
      'zh-TW': '九龍尖沙咀彌敦道132號',
      'en': '132 Nathan Road, Tsim Sha Tsui, Kowloon'
    },
    type: 'private',
    availability: 'today',
    tags: ['medical', 'private'],
    distance: 0.5,
    rating: 4.9,
    image: 'https://picsum.photos/seed/qmh/200/150',
    hasElectronicReport: false,
    phone: '+852 2368 5678',
    hours: '09:00-19:00',
    reviewsCount: 85,
    coords: { x: 52, y: 48 },
    reviews: [
      { id: 'r3', user: '李小姐', rating: 4, date: '2026-03-10', text: '牙医很温柔，环境也很好。', tags: ['温柔', '环境好'] }
    ]
  },
  {
    id: 3,
    name: {
      'zh-CN': '卓健医疗 (Quality HealthCare)',
      'zh-TW': '卓健醫療 (Quality HealthCare)',
      'en': 'Quality HealthCare'
    },
    address: {
      'zh-CN': '中环德辅道中71号永安集团大厦',
      'zh-TW': '中環德輔道中71號永安集團大廈',
      'en': 'Wing On House, 71 Des Voeux Road Central'
    },
    type: 'chain',
    availability: 'today',
    tags: ['medical', 'report', 'breakfast'],
    distance: 0.8,
    rating: 4.5,
    image: 'https://picsum.photos/seed/qhc/200/150',
    hasElectronicReport: true,
    phone: '+852 2801 1234',
    hours: '09:00-18:00',
    reviewsCount: 210,
    coords: { x: 48, y: 52 },
    reviews: []
  },
  {
    id: 4,
    name: {
      'zh-CN': '港怡医院 (Gleneagles)',
      'zh-TW': '港怡醫院 (Gleneagles)',
      'en': 'Gleneagles Hospital Hong Kong'
    },
    address: {
      'zh-CN': '香港黄竹坑南风径1号',
      'zh-TW': '香港黃竹坑南風徑1號',
      'en': '1 Nam Fung Path, Wong Chuk Hang, Hong Kong'
    },
    type: 'private',
    availability: '3days',
    tags: ['medical', 'private', 'report'],
    distance: 2.1,
    rating: 5,
    image: 'https://picsum.photos/seed/gle/200/150',
    hasElectronicReport: true,
    phone: '+852 3153 9000',
    hours: '09:00-18:00',
    reviewsCount: 56,
    coords: { x: 42, y: 65 },
    reviews: []
  },
  {
    id: 5,
    name: {
      'zh-CN': '律敦治医院 (Ruttonjee)',
      'zh-TW': '律敦治醫院 (Ruttonjee)',
      'en': 'Ruttonjee Hospital'
    },
    address: {
      'zh-CN': '香港湾仔皇后大道东266号',
      'zh-TW': '香港灣仔皇后大道東266號',
      'en': '266 Queen\'s Road East, Wan Chai, Hong Kong'
    },
    type: 'public',
    availability: '15days',
    tags: ['medical', 'public'],
    distance: 1.5,
    rating: 3.5,
    image: 'https://picsum.photos/seed/rut/200/150',
    hasElectronicReport: false,
    phone: '+852 2291 2000',
    hours: '08:30-17:30',
    reviewsCount: 42,
    coords: { x: 55, y: 58 },
    reviews: []
  },
  {
    id: 6,
    name: {
      'zh-CN': '盈健医疗 (Human Health)',
      'zh-TW': '盈健醫療 (Human Health)',
      'en': 'Human Health'
    },
    address: {
      'zh-CN': '尖沙咀海港城世界商业中心',
      'zh-TW': '尖沙咀海港城世界商業中心',
      'en': 'World Commerce Centre, Harbour City, TST'
    },
    type: 'chain',
    availability: 'tomorrow',
    tags: ['medical', 'report'],
    distance: 0.5,
    rating: 4,
    image: 'https://picsum.photos/seed/hum/200/150',
    hasElectronicReport: true,
    phone: '+852 2368 5678',
    hours: '09:00-19:00',
    reviewsCount: 94,
    coords: { x: 50, y: 45 },
    reviews: []
  },
  {
    id: 7,
    name: {
      'zh-CN': '圣德肋撒医院 (St. Teresa\'s)',
      'zh-TW': '聖德肋撒醫院 (St. Teresa\'s)',
      'en': 'St. Teresa\'s Hospital'
    },
    address: {
      'zh-CN': '九龙太子道西327号',
      'zh-TW': '九龍太子道西327號',
      'en': '327 Prince Edward Road West, Kowloon'
    },
    type: 'private',
    availability: 'today',
    tags: ['medical', 'private', 'breakfast'],
    distance: 4.2,
    rating: 4.5,
    image: 'https://picsum.photos/seed/sth/200/150',
    hasElectronicReport: false,
    phone: '+852 2200 3434',
    hours: '09:00-18:00',
    reviewsCount: 112,
    coords: { x: 60, y: 40 },
    reviews: []
  },
  {
    id: 8,
    name: {
      'zh-CN': '威尔斯亲王医院 (PWH)',
      'zh-TW': '威爾斯親王醫院 (PWH)',
      'en': 'Prince of Wales Hospital (PWH)'
    },
    address: {
      'zh-CN': '新界沙田银成街30-32号',
      'zh-TW': '新界沙田銀成街30-32號',
      'en': '30-32 Ngan Shing Street, Sha Tin, NT'
    },
    type: 'public',
    availability: '30days',
    tags: ['medical', 'public'],
    distance: 12.0,
    rating: 4,
    image: 'https://picsum.photos/seed/pwh/200/150',
    hasElectronicReport: false,
    phone: '+852 3505 2211',
    hours: '08:00-17:00',
    reviewsCount: 156,
    coords: { x: 70, y: 30 },
    reviews: []
  }
];

const translations = {
  'zh-CN': {
    title: 'AI医生',
    greeting: '哈喽',
    subtitle: '愿你感受当下小美好',
    health: '我的权益',
    updated: '更新于',
    steps: '医疗网络折扣',
    stepUnit: '20%',
    videoConsult: '视频问诊',
    videoConsultUnit: '10次',
    checkup: '免费体检',
    checkupUnit: '1次',
    questions: [
      "感冒了可以运动吗？",
      "如何缓解长期伏案导致的颈椎疼痛？",
      "体检报告中尿酸偏高需要注意什么？"
    ],
    findDoctor: '找医生',
    findHospital: '找医院',
    checkBenefits: '查权益',
    inputPlaceholder: '发消息...',
    langName: '简体中文',
    checkupTitle: '选择体检机构',
    hospitalType: '医院类型',
    appointmentTime: '预约时间',
    quickFilter: '快捷筛选',
    nearest: '距离最近',
    electronicReport: '电子报告',
    within3Days: '3天内可约',
    types: { public: '公立', private: '私立', chain: '连锁' },
    times: { today: '当日可约', tomorrow: '次日可约', '3days': '3天内', '7days': '7天内', '15days': '15天内', '30days': '30天内', anytime: '随时' },
    noResults: '暂无匹配的体检机构',
    tags: { medical: '医疗资质', public: '公立医院', private: '私立医院', breakfast: '营养早餐', report: '电子报告' },
    benefits: {
      title: '我的权益',
      summary: (total: number, usedUp: number, expiring: number) => `共${total}项权益, 已用完${usedUp}项, 即将到期${expiring}项`,
      used: '已用',
      total: '共',
      remaining: '剩余',
      validUntil: '有效期至',
      expiringSoon: '即将到期',
      viewAll: '查看全部',
      usageRecords: '使用记录',
      noRecords: '暂无使用记录',
      status: {
        available: '可用',
        usedUp: '已用完',
        expiring: '即将到期'
      }
    },
    doctors: {
      title: '找医生',
      symptomSummary: '症状总结',
      suggestedDept: '建议科室',
      allDistricts: '全部地区',
      match: '匹配',
      call: '电话',
      book: '预约',
      experience: '年经验',
      categories: { all: '全部', gp: '全科', dental: '牙科', tcm: '中医', gastro: '消化科', derm: '皮肤科' },
      tiers: { '3A': '三甲', central: '中心', private: '私立' },
      breakdown: {
        professional: '专业能力',
        service: '服务态度',
        experience: '治疗体验',
        outcome: '治疗效果'
      },
      videoConsult: '视频问诊',
      bookNow: '立即预约',
      patientReviews: '患者评价',
      reviewsDisclaimer: '此评价为用户填写，与本公司无关。',
      viewAllReviews: '查看全部 >',
      availableSlots: '可预约时段',
      viewRecommended: '查看推荐医生'
    },
    hospitals: {
      title: '找医院',
      searchPlaceholder: '搜索医疗机构...',
      mapView: '地图',
      listView: '列表',
      navigate: '导航',
      address: '地址',
      phone: '电话',
      hours: '营业时间',
      userReviews: '用户评价',
      count: (n: number) => `共 ${n} 间医疗机构`
    },
    error: '抱歉，服务暂时不可用，请稍后再试。'
  },
  'zh-TW': {
    title: 'AI医生',
    greeting: '哈囉',
    subtitle: '願你感受當下小美好',
    health: '我的權益',
    updated: '更新於',
    steps: '醫療網絡折扣',
    stepUnit: '20%',
    videoConsult: '視頻問診',
    videoConsultUnit: '10次',
    checkup: '免費體檢',
    checkupUnit: '1次',
    questions: [
      "感冒了可以運動嗎？",
      "如何緩解長期伏案導致的頸椎疼痛？",
      "體檢報告中尿酸偏高需要注意什麼？"
    ],
    findDoctor: '找醫生',
    findHospital: '找醫院',
    checkBenefits: '查權益',
    inputPlaceholder: '發消息...',
    langName: '繁體中文',
    checkupTitle: '選擇體檢機構',
    hospitalType: '醫院類型',
    appointmentTime: '預約時間',
    quickFilter: '快捷篩選',
    nearest: '距離最近',
    electronicReport: '電子報告',
    within3Days: '3天內可約',
    types: { public: '公立', private: '私营', chain: '連鎖' },
    times: { today: '當日可約', tomorrow: '次日可約', '3days': '3天內', '7days': '7天內', '15days': '15天內', '30days': '30天內', anytime: '隨時' },
    noResults: '暫無匹配的體檢機構',
    tags: { medical: '醫療資質', public: '公立醫院', private: '私家醫院', breakfast: '營養早餐', report: '電子報告' },
    benefits: {
      title: '我的權益',
      summary: (total: number, usedUp: number, expiring: number) => `共${total}項權益, 已用完${usedUp}項, 即將到期${expiring}項`,
      used: '已用',
      total: '共',
      remaining: '剩餘',
      validUntil: '有效期至',
      expiringSoon: '即將到期',
      viewAll: '查看全部',
      usageRecords: '使用記錄',
      noRecords: '暫無使用記錄',
      status: {
        available: '可用',
        usedUp: '已用完',
        expiring: '即將到期'
      }
    },
    doctors: {
      title: '找醫生',
      symptomSummary: '症狀總結',
      suggestedDept: '建議科室',
      allDistricts: '全部地區',
      match: '匹配',
      call: '電話',
      book: '預約',
      experience: '年經驗',
      categories: { all: '全部', gp: '全科', dental: '牙科', tcm: '中醫', gastro: '消化科', derm: '皮膚科' },
      tiers: { '3A': '三甲', central: '中心', private: '私立' },
      breakdown: {
        professional: '專業能力',
        service: '服務態度',
        experience: '治療體驗',
        outcome: '治療效果'
      },
      videoConsult: '視頻問診',
      bookNow: '立即預約',
      patientReviews: '患者評價',
      reviewsDisclaimer: '此評價為用戶填寫，與本公司無關。',
      viewAllReviews: '查看全部 >',
      availableSlots: '可預約時段',
      viewRecommended: '查看推薦醫生'
    },
    hospitals: {
      title: '找醫院',
      searchPlaceholder: '搜索醫療機構...',
      mapView: '地圖',
      listView: '列表',
      navigate: '導航',
      address: '地址',
      phone: '電話',
      hours: '營業時間',
      userReviews: '用戶評價',
      count: (n: number) => `共 ${n} 間醫療機構`
    },
    error: '抱歉，服務暫時不可用，請稍後再試。'
  },
  'en': {
    title: 'AI Doctor',
    greeting: 'Hello',
    subtitle: 'May you feel the beauty of the moment',
    health: 'My Benefits',
    updated: 'Updated at',
    steps: 'Medical Network Discount',
    stepUnit: '20%',
    videoConsult: 'Video Consult',
    videoConsultUnit: '10 times',
    checkup: 'Free Checkup',
    checkupUnit: '1 time',
    questions: [
      "Can I exercise when I have a cold?",
      "How to relieve neck pain caused by sitting at a desk for a long time?",
      "What should I pay attention to if my uric acid is high in the checkup report?",
    ],
    findDoctor: 'Find Doctor',
    findHospital: 'Find Hospital',
    checkBenefits: 'Benefits',
    inputPlaceholder: 'Message...',
    langName: 'English',
    checkupTitle: 'Select Institution',
    hospitalType: 'Type',
    appointmentTime: 'Time',
    quickFilter: 'Quick Filter',
    nearest: 'Nearest',
    electronicReport: 'E-Report',
    within3Days: 'Within 3 Days',
    types: { public: 'Public', private: 'Private', chain: 'Chain' },
    times: { today: 'Today', tomorrow: 'Tomorrow', '3days': '3 Days', '7days': '7 Days', '15days': '15 Days', '30days': '30 Days', anytime: 'Anytime' },
    noResults: 'No matching institutions found',
    tags: { medical: 'Medical Qual.', public: 'Public Hospital', private: 'Private Hospital', breakfast: 'Breakfast', report: 'E-Report' },
    benefits: {
      title: 'My Benefits',
      summary: (total: number, usedUp: number, expiring: number) => `Total ${total} benefits, ${usedUp} used up, ${expiring} expiring soon`,
      used: 'Used',
      total: 'Total',
      remaining: 'Remaining',
      validUntil: 'Valid until',
      expiringSoon: 'Expiring Soon',
      viewAll: 'View All',
      usageRecords: 'Usage Records',
      noRecords: 'No usage records yet',
      status: {
        available: 'Available',
        usedUp: 'Used Up',
        expiring: 'Expiring'
      }
    },
    doctors: {
      title: 'Find Doctor',
      symptomSummary: 'Symptom Summary',
      suggestedDept: 'Suggested Dept',
      allDistricts: 'All Districts',
      match: 'Match',
      call: 'Call',
      book: 'Book',
      experience: 'Yrs Exp',
      categories: { all: 'All', gp: 'GP', dental: 'Dental', tcm: 'TCM', gastro: 'Gastro', derm: 'Derm' },
      tiers: { '3A': 'Tier-3A', central: 'Central', private: 'Private' },
      breakdown: {
        professional: 'Professional Competence',
        service: 'Service Attitude',
        experience: 'Treatment Experience',
        outcome: 'Treatment Outcome'
      },
      videoConsult: 'Video Consultation',
      bookNow: 'Book Now',
      patientReviews: 'Patient Reviews',
      reviewsDisclaimer: 'These reviews are provided by users and are not affiliated with our company.',
      viewAllReviews: 'View All >',
      availableSlots: 'Available Slots',
      viewRecommended: 'View Recommended Doctors'
    },
    hospitals: {
      title: 'Find Hospital',
      searchPlaceholder: 'Search medical institutions...',
      mapView: 'Map',
      listView: 'List',
      navigate: 'Navigate',
      address: 'Address',
      phone: 'Phone',
      hours: 'Hours',
      userReviews: 'User Reviews',
      count: (n: number) => `Total ${n} institutions`
    },
    error: 'Sorry, the service is temporarily unavailable. Please try again later.'
  }
};

const BenefitStatusCard = ({ benefit, lang, onViewAll }: { benefit: Benefit, lang: Language, onViewAll: () => void }) => {
  const t = translations[lang].benefits;
  const progress = (benefit.used / benefit.total) * 100;
  const remaining = benefit.total - benefit.used;

  return (
    <div className="mt-2 bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm w-full p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            {benefit.icon}
          </div>
          <span className="font-bold text-gray-800 text-sm">{benefit.name[lang]}</span>
        </div>
        <div className="text-sm font-bold text-blue-600">
          {t.remaining} {remaining} {lang === 'en' ? 'Times' : '次'}
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>{t.used} {benefit.used} / {t.total} {benefit.total}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-blue-600"
          />
        </div>
      </div>

      <button
        onClick={onViewAll}
        className="w-full py-1.5 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
      >
        {t.viewAll} <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};

const BenefitsPage = ({ lang, onClose, onSelectBenefit, selectedBenefitId }: {
  lang: Language,
  onClose: () => void,
  onSelectBenefit: (id: string | null) => void,
  selectedBenefitId: string | null
}) => {
  const t = translations[lang].benefits;
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const usedUpCount = mockBenefits.filter(b => b.used >= b.total).length;
  const expiringCount = mockBenefits.filter(b => {
    const expiry = new Date(b.validUntil);
    return expiry <= thirtyDaysLater && expiry >= now;
  }).length;

  const selectedBenefit = mockBenefits.find(b => b.id === selectedBenefitId);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-[#f8faff] z-[100] flex flex-col"
    >
      <header className="px-4 py-4 flex items-center gap-4 bg-white border-b border-gray-100">
        <button onClick={() => selectedBenefitId ? onSelectBenefit(null) : onClose()} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">{selectedBenefitId ? selectedBenefit?.name[lang] : t.title}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {!selectedBenefitId ? (
          <>
            <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-gray-50">
              <p className="text-sm text-gray-500 leading-relaxed">
                {t.summary(mockBenefits.length, usedUpCount, expiringCount)}
              </p>
            </div>

            <div className="space-y-4">
              {mockBenefits.map(benefit => {
                const progress = (benefit.used / benefit.total) * 100;
                const expiry = new Date(benefit.validUntil);
                const isExpiring = expiry <= thirtyDaysLater && expiry >= now;
                const isUsedUp = benefit.used >= benefit.total;

                return (
                  <motion.div
                    key={benefit.id}
                    onClick={() => onSelectBenefit(benefit.id)}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                          {benefit.icon}
                        </div>
                        <span className="font-bold text-gray-800">{benefit.name[lang]}</span>
                      </div>
                      {isExpiring && (
                        <span className="px-2 py-1 bg-red-50 text-red-500 text-[10px] font-bold rounded-lg flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t.expiringSoon}
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                        <span>{t.used} {benefit.used} / {t.total} {benefit.total}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-gray-400">
                      <span>{t.validUntil}: {benefit.validUntil}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    {selectedBenefit?.icon}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-gray-800">{selectedBenefit?.name[lang]}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedBenefit!.used >= selectedBenefit!.total ? 'bg-gray-100 text-gray-500' :
                        (new Date(selectedBenefit!.validUntil) <= thirtyDaysLater ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500')
                      }`}>
                      {selectedBenefit!.used >= selectedBenefit!.total ? t.status.usedUp :
                        (new Date(selectedBenefit!.validUntil) <= thirtyDaysLater ? t.status.expiring : t.status.available)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{t.used} {selectedBenefit?.used} / {t.total} {selectedBenefit?.total}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${(selectedBenefit!.used / selectedBenefit!.total) * 100}%` }} />
                </div>
              </div>

              <div className="text-xs text-gray-400">
                {t.validUntil}: {selectedBenefit?.validUntil}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-3 px-1">{t.usageRecords}</h3>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-50">
                {selectedBenefit?.records.length ? selectedBenefit.records.map((record, i) => (
                  <div key={i} className="p-4 border-b border-gray-50 last:border-0 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-gray-800">{record.description[lang]}</span>
                      <span className="text-[11px] text-gray-400">{record.date}</span>
                    </div>
                    <span className="text-blue-600 font-bold">{record.amount[lang]}</span>
                  </div>
                )) : (
                  <div className="p-8 text-center text-gray-400 text-sm">{t.noRecords}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<{ name: string, gender: 'Mr.' | 'Ms.' } | null>(null);
  const [loadTime, setLoadTime] = useState('');
  const [showCheckupPage, setShowCheckupPage] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'type' | 'time' | null>(null);
  const t = translations[lang];

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showBenefitsPage, setShowBenefitsPage] = useState(false);
  const [selectedBenefitId, setSelectedBenefitId] = useState<string | null>(null);
  const [showDoctorPage, setShowDoctorPage] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [showHospitalPage, setShowHospitalPage] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const parseTriage = (text: string) => {
    let triageData = null;
    let disclaimer = undefined;
    let cleanText = text;
    let suggestions: string[] = [];
    let benefitStatuses: string[] = [];

    // 1. Handle Disclaimer (extract and remove)
    const disclaimerStartIndex = cleanText.indexOf('[DISCLAIMER]');
    if (disclaimerStartIndex !== -1) {
      const disclaimerEndIndex = cleanText.indexOf('[/DISCLAIMER]');
      if (disclaimerEndIndex !== -1) {
        disclaimer = cleanText.substring(disclaimerStartIndex + 12, disclaimerEndIndex).trim();
        cleanText = (cleanText.substring(0, disclaimerStartIndex) + cleanText.substring(disclaimerEndIndex + 13)).trim();
      } else {
        disclaimer = cleanText.substring(disclaimerStartIndex + 12).trim();
        cleanText = cleanText.substring(0, disclaimerStartIndex).trim();
      }
    }

    // 2. Handle Suggestions (extract and remove)
    const suggestionsRegex = /suggestions\s*(\[.*?\])/s;
    const suggestionsMatch = cleanText.match(suggestionsRegex);
    if (suggestionsMatch) {
      try {
        suggestions = JSON.parse(suggestionsMatch[1]);
        cleanText = cleanText.replace(suggestionsRegex, '').trim();
      } catch (e) {
        // Partial match during streaming - just hide it
        cleanText = cleanText.replace(suggestionsRegex, '').trim();
      }
    }

    // 3. Handle Triage (extract and remove)
    const triageStartIndex = cleanText.indexOf('triage{');
    if (triageStartIndex !== -1) {
      const triageEndIndex = cleanText.indexOf('}', triageStartIndex);
      if (triageEndIndex !== -1) {
        try {
          const jsonStr = cleanText.substring(triageStartIndex + 6, triageEndIndex + 1);
          triageData = JSON.parse(jsonStr);
          cleanText = (cleanText.substring(0, triageStartIndex) + cleanText.substring(triageEndIndex + 1)).trim();
        } catch (e) {
          cleanText = cleanText.substring(0, triageStartIndex).trim();
        }
      } else {
        cleanText = cleanText.substring(0, triageStartIndex).trim();
      }
    }

    // 4. Handle Benefit Status (inline cards)
    const benefitRegex = /benefit_status\{id:"(.*?)"\}/g;
    const benefitStatusesSet = new Set<string>();
    let match;
    while ((match = benefitRegex.exec(cleanText)) !== null) {
      benefitStatusesSet.add(match[1]);
    }
    benefitStatuses = Array.from(benefitStatusesSet);
    if (benefitStatuses.length > 0) {
      cleanText = cleanText.replace(/benefit_status\{id:".*?"\}/g, '').trim();
    }

    return { triageData, cleanText, disclaimer, benefitStatuses, suggestions };
  };

  useEffect(() => { }, []);

  const handleSendMessage = async (textOverride?: string) => {
    const text = textOverride || inputValue;
    if (!text && !selectedImage) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      text: text,
      image: selectedImage || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setSelectedImage(null);
    setIsThinking(true);

    try {
      const history: GeminiMessage[] = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let fullResponse = '';
      let hasStarted = false;
      let rafId: number | null = null;
      let rafPending = false;

      const flushStreaming = () => {
        rafPending = false;
        const { cleanText } = parseTriage(fullResponse);
        setMessages(prev => prev.map(m =>
          m.id === aiMessageId
            ? { ...m, text: cleanText }
            : m
        ));
        scrollToBottom(false);
      };

      const scheduleFlush = () => {
        if (rafPending) return;
        rafPending = true;
        rafId = requestAnimationFrame(flushStreaming);
      };

      let stream;
      if (userMessage.image) {
        const base64Data = userMessage.image.split(',')[1];
        const mimeType = userMessage.image.split(';')[0].split(':')[1];
        stream = analyzeImageStream(base64Data, mimeType, text || "Analyze this image", lang);
      } else {
        stream = chatWithGeminiStream(history, text, lang);
      }

      for await (const chunk of stream) {
        // 思考中的 chunk，保持 thinking 动画
        if (chunk === '\x00THINKING') continue;

        if (!hasStarted) {
          setIsThinking(false);
          setMessages(prev => [...prev, {
            id: aiMessageId,
            role: 'model',
            text: '',
            isStreaming: true,
          }]);
          hasStarted = true;
        }

        fullResponse += chunk;
        scheduleFlush();
      }

      // 流结束：取消待处理 RAF，做完整解析，关闭 streaming 标记
      if (rafId !== null) cancelAnimationFrame(rafId);
      const { triageData, cleanText, disclaimer, benefitStatuses, suggestions } = parseTriage(fullResponse);
      setMessages(prev => prev.map(m =>
        m.id === aiMessageId
          ? { ...m, text: cleanText, triage: triageData, disclaimer, benefitStatuses, suggestions, isStreaming: false }
          : m
      ));
      scrollToBottom(false);

    } catch (error) {
      console.error("Chat Error:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'model',
        text: (translations[lang] as any).error,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Filters
  const [typeFilter, setTypeFilter] = useState<'public' | 'private' | 'chain' | null>(null);
  const [timeFilter, setTimeFilter] = useState<Institution['availability'] | null>(null);
  const [quickFilters, setQuickFilters] = useState<string[]>([]);

  const filteredInstitutions = useMemo(() => {
    return mockInstitutions.filter(inst => {
      if (typeFilter && inst.type !== typeFilter) return false;
      if (timeFilter && inst.availability !== timeFilter) return false;

      if (quickFilters.includes('report') && !inst.hasElectronicReport) return false;
      if (quickFilters.includes('3days') && !['today', 'tomorrow', '3days'].includes(inst.availability)) return false;

      return true;
    }).sort((a, b) => {
      if (quickFilters.includes('nearest')) return a.distance - b.distance;
      return 0;
    });
  }, [typeFilter, timeFilter, quickFilters]);

  useEffect(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setLoadTime(`${month}-${day} ${hours}:${minutes}`);
  }, []);

  if (!isLoggedIn) {
    return <LoginPage onLogin={(name, gender) => {
      setUserData({ name, gender });
      setIsLoggedIn(true);
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#f8faff] text-[#1a1a1a] font-sans overflow-x-hidden pb-40 relative">
      {/* Aurora Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200/40 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] bg-blue-200/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-pink-100/40 rounded-full blur-[120px]" />
      </div>

      {/* Background Text */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        <span className="text-[20vw] font-black text-blue-500/5 select-none tracking-tighter">HEALTH</span>
      </div>

      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between fixed top-0 left-0 right-0 z-50 bg-white/40 backdrop-blur-xl border-b border-white/20">
        <div className="flex items-center gap-2">

          <span className="text-xl font-bold">{t.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-white/50">
            <button
              onClick={() => setLang('zh-TW')}
              className={`text-xs font-bold transition-colors ${lang === 'zh-TW' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              繁
            </button>
            <span className="mx-1.5 text-[10px] text-gray-300 select-none">|</span>
            <button
              onClick={() => setLang('en')}
              className={`text-xs font-bold transition-colors ${lang === 'en' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              En
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div
        ref={scrollRef}
        className="fixed inset-0 pt-20 pb-40 overflow-y-auto no-scrollbar z-10 px-4"
      >
        {/* Hero Section */}
        <section className="pt-4 pb-8 relative">
          <div className="max-w-[60%]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-1"
            >
              <h1 className="text-2xl font-bold">
                {userData ? `${userData.gender} ${userData.name}` : t.greeting}
              </h1>
              <Sparkles className="w-5 h-5 text-blue-400 fill-blue-400" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-xl font-medium text-blue-900/80 mt-1"
            >
              {t.subtitle}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="absolute right-2 bottom-0 w-32 h-32 z-0 translate-y-1"
          >
            <img
              src="https://pic1.imgdb.cn/item/69d73535c9d0f979b7e0bfea.webp"
              alt="Character"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              loading="eager"
              fetchPriority="high"
            />
          </motion.div>
        </section>

        {/* My Benefits Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-linear-to-br from-white/5 to-white/1 rounded-[32px] p-1 shadow-[0_32px_64px_-16px_rgba(148,163,184,0.15)] border border-white/60 overflow-hidden mb-8"
        >
          <div className="p-5 bg-white/60 rounded-[28px] m-1">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                <span className="font-bold text-gray-800">{t.health}</span>
                <span className="text-[10px] text-gray-400 ml-1 flex items-center gap-1 whitespace-nowrap">
                  {t.updated}{loadTime} <RefreshCw className="w-2.5 h-2.5" />
                </span>
              </div>
              <div className="bg-gray-50/50 p-1 rounded-full">
                <ChevronUp className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="grid grid-cols-3 items-center">
              <div className="text-center">
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-2xl font-bold text-blue-600">{t.stepUnit}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.steps}</p>
              </div>

              <div className="flex justify-center">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-blue-50/50" />
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={175.9} strokeDashoffset={40} strokeLinecap="round" className="text-blue-400" />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-600 leading-none">{t.videoConsultUnit}</span>
                    <span className="text-[8px] text-gray-400 scale-90">{t.videoConsult}</span>
                  </div>
                </div>
              </div>

              <div className="text-center cursor-pointer group" onClick={() => setShowCheckupPage(true)}>
                <div className="text-lg font-bold text-blue-600 group-hover:scale-110 transition-transform">{t.checkupUnit}</div>
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-gray-400 font-medium mt-0.5 leading-tight">
                  {t.checkup} <ChevronRight className="w-3 h-3 text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Chat Messages */}
        <div className="space-y-4 pb-4">
          <div className="space-y-3 mb-4">
            {t.questions.map((question, index) => (
              <motion.div
                key={`${lang}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                onClick={() => handleSendMessage(question)}
                className="bg-white/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-3 border border-white/40 group cursor-pointer hover:bg-white/60 transition-all duration-300"
              >
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <Hash className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-[15px] font-medium text-gray-800 flex-1 leading-snug">
                  {question}
                </p>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
              </motion.div>
            ))}
          </div>

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`p-3 shadow-sm message-bubble ${msg.role === 'user'
                    ? 'max-w-[85%] bg-[#1A56DB] text-white rounded-2xl rounded-tr-none'
                    : 'w-full bg-white text-gray-800 rounded-2xl rounded-tl-none border border-gray-100'
                  }`}
              >
                {msg.image && (
                  <img src={msg.image} alt="Uploaded" className="max-w-full rounded-lg mb-2" />
                )}
                {msg.role === 'user' ? (
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <>
                    <div className="markdown-body text-[15px] leading-relaxed">
                      <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                    </div>
                    {msg.disclaimer && (
                      <div className="mt-4 pt-3 border-t border-gray-100 text-[13px] text-gray-400 leading-relaxed italic">
                        {msg.disclaimer}
                      </div>
                    )}
                  </>
                )}

                {msg.triage && msg.triage.level !== 'self_care' && (
                  <TriageCard
                    triage={msg.triage}
                    lang={lang}
                    onViewDoctors={() => setShowDoctorPage(true)}
                  />
                )}

                {msg.benefitStatuses && msg.benefitStatuses.map((id, bIdx) => (
                  <BenefitStatusCard
                    key={`${msg.id}-${id}-${bIdx}`}
                    benefit={mockBenefits.find(b => b.id === id) || mockBenefits[0]}
                    lang={lang}
                    onViewAll={() => {
                      setSelectedBenefitId(id);
                      setShowBenefitsPage(true);
                    }}
                  />
                ))}
              </div>

              {msg.role === 'model' && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 w-full max-w-[90%]">
                  {msg.suggestions.map((suggestion, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => handleSendMessage(suggestion)}
                      className="bg-white border border-gray-100 text-gray-900 px-4 py-3 rounded-2xl text-[14px] font-medium shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all text-left flex items-center justify-between group"
                    >
                      <span className="flex-1">{suggestion}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {isThinking && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none flex gap-1 items-center message-bubble">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                />
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                />
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom Action Pills */}
      <div className="fixed bottom-[80px] left-0 right-0 px-4 overflow-x-auto no-scrollbar z-40">
        <div className="flex items-center gap-2 min-w-max pb-2">
          <ActionButton
            icon={<Stethoscope className="w-4 h-4" />}
            label={t.findDoctor}
            onClick={() => setShowDoctorPage(true)}
          />
          <ActionButton
            icon={<Hospital className="w-4 h-4" />}
            label={t.findHospital}
            onClick={() => setShowHospitalPage(true)}
          />
          <ActionButton
            icon={<ShieldCheck className="w-4 h-4" />}
            label={t.checkBenefits}
            onClick={() => setShowBenefitsPage(true)}
          />
        </div>
      </div>

      <AnimatePresence>
        {showDoctorPage && (
          <DoctorListPage
            lang={lang}
            onClose={() => setShowDoctorPage(false)}
            onSelectDoctor={setSelectedDoctorId}
            triage={messages.filter(m => m.role === 'model').reverse().find(m => m.triage)?.triage}
          />
        )}
        {selectedDoctorId && (
          <DoctorDetailPage
            doctor={mockDoctors.find(d => d.id === selectedDoctorId)!}
            lang={lang}
            onClose={() => setSelectedDoctorId(null)}
          />
        )}
        {showHospitalPage && (
          <HospitalListPage
            lang={lang}
            onClose={() => setShowHospitalPage(false)}
            onSelectHospital={setSelectedHospitalId}
          />
        )}
        {selectedHospitalId && (
          <HospitalDetailPage
            hospital={mockInstitutions.find(h => h.id === selectedHospitalId)!}
            lang={lang}
            onClose={() => setSelectedHospitalId(null)}
          />
        )}
        {showBenefitsPage && (
          <BenefitsPage
            lang={lang}
            onClose={() => setShowBenefitsPage(false)}
            onSelectBenefit={setSelectedBenefitId}
            selectedBenefitId={selectedBenefitId}
          />
        )}
      </AnimatePresence>

      {/* Input Bar */}
      <div className="fixed bottom-6 left-0 right-0 px-4 z-50">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-1.5 flex flex-col gap-2">
          {selectedImage && (
            <div className="relative w-20 h-20 ml-2 mt-1">
              <img src={selectedImage} alt="Preview" className="w-full h-full object-cover rounded-lg" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 shadow-md"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 pl-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={t.inputPlaceholder}
              className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] placeholder:text-gray-400"
            />
            <div className="flex items-center gap-1 pr-1">
              <label className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 cursor-pointer">
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </label>
              <button
                onClick={() => handleSendMessage()}
                disabled={isThinking || (!inputValue && !selectedImage)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${inputValue || selectedImage ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'
                  }`}
              >
                {isThinking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Checkup Selection Page Overlay */}
      <AnimatePresence>
        {showCheckupPage && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-[#f8faff] flex flex-col"
          >
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md px-4 py-4 flex items-center gap-4 border-b border-gray-100 shrink-0">
              <button
                onClick={() => setShowCheckupPage(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-700" />
              </button>
              <h2 className="text-lg font-bold text-gray-800">{t.checkupTitle}</h2>
            </div>

            {/* Filters Section */}
            <div className="bg-white px-4 py-3 space-y-3 shadow-sm relative z-50 shrink-0">
              {/* Dropdown Filters Side-by-Side */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-all border ${typeFilter ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-transparent text-gray-600'
                      }`}
                  >
                    <span className="truncate">{typeFilter ? t.types[typeFilter] : t.hospitalType}</span>
                    <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${openDropdown === 'type' ? '' : 'rotate-180'}`} />
                  </button>

                  <AnimatePresence>
                    {openDropdown === 'type' && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[-1]" onClick={() => setOpenDropdown(null)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 4, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="absolute left-0 right-0 top-full bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50"
                        >
                          {(['public', 'private', 'chain'] as const).map(type => (
                            <button
                              key={type}
                              onClick={() => { setTypeFilter(typeFilter === type ? null : type); setOpenDropdown(null); }}
                              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${typeFilter === type ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                                }`}
                            >
                              {t.types[type]}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1 relative">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'time' ? null : 'time')}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-all border ${timeFilter ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-transparent text-gray-600'
                      }`}
                  >
                    <span className="truncate">{timeFilter ? t.times[timeFilter] : t.appointmentTime}</span>
                    <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${openDropdown === 'time' ? '' : 'rotate-180'}`} />
                  </button>

                  <AnimatePresence>
                    {openDropdown === 'time' && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[-1]" onClick={() => setOpenDropdown(null)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 4, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="absolute left-0 right-0 top-full bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 max-h-[300px] overflow-y-auto no-scrollbar"
                        >
                          {(['today', 'tomorrow', '3days', '7days', '15days', '30days', 'anytime'] as const).map(time => (
                            <button
                              key={time}
                              onClick={() => { setTimeFilter(timeFilter === time ? null : time); setOpenDropdown(null); }}
                              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${timeFilter === time ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                                }`}
                            >
                              {t.times[time]}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] text-gray-400 font-bold shrink-0 uppercase tracking-wider">{t.quickFilter}:</span>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'nearest', label: t.nearest },
                    { id: 'report', label: t.electronicReport },
                    { id: '3days', label: t.within3Days }
                  ].map(qf => (
                    <button
                      key={qf.id}
                      onClick={() => setQuickFilters(prev =>
                        prev.includes(qf.id) ? prev.filter(i => i !== qf.id) : [...prev, qf.id]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${quickFilters.includes(qf.id)
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-blue-200'
                        }`}
                    >
                      {qf.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* List Section */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
              {filteredInstitutions.length > 0 ? (
                filteredInstitutions.map((inst, index) => (
                  <motion.div
                    key={inst.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl p-3 flex gap-3 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform"
                  >
                    <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                      <img
                        src={inst.image}
                        alt={inst.name[lang]}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[15px] font-bold text-gray-800 truncate">{inst.name[lang]}</h3>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Star className="w-3 h-3 text-orange-400 fill-orange-400" />
                            <span className="text-[11px] font-bold text-orange-400">{inst.rating}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <p className="text-[11px] text-gray-400 truncate">{inst.address[lang]}</p>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {inst.tags.map((tagKey, tIdx) => (
                            <span
                              key={`${tagKey}-${tIdx}`}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${tagKey === 'public' ? 'bg-blue-50 text-blue-500' :
                                  tagKey === 'private' ? 'bg-purple-50 text-purple-500' :
                                    'bg-gray-50 text-gray-500'
                                }`}
                            >
                              {t.tags[tagKey]}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600">
                          <Clock className="w-3 h-3" />
                          <span>{t.times[inst.availability]}</span>
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium">{inst.distance}km</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Search className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">{t.noResults}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: ReactNode, label: string, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-white/50 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
    >
      <span className="text-blue-500">{icon}</span>
      {label}
    </button>
  );
}

function TriageCard({ triage, lang, onViewDoctors }: { triage: ChatMessage['triage'], lang: Language, onViewDoctors?: () => void }) {
  if (!triage) return null;

  const config = {
    self_care: { color: 'bg-emerald-500', label: { 'zh-CN': '自行护理 Self Care', 'zh-TW': '自行護理 Self Care', 'en': 'Self Care' } },
    suggest_online: { color: 'bg-amber-400', label: { 'zh-CN': '建议线上问诊 Suggest Online Consultation', 'zh-TW': '建議線上問診 Suggest Online Consultation', 'en': 'Suggest Online Consultation' } },
    visit_hospital: { color: 'bg-red-500', label: { 'zh-CN': '建议就医 Visit Hospital', 'zh-TW': '建議就醫 Visit Hospital', 'en': 'Visit Hospital' } },
  };

  const current = config[triage.level];

  return (
    <div className="mt-4 bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm w-full">
      <div className={`${current.color} px-3 py-2 text-white text-xs font-bold`}>
        {current.label[lang]}
      </div>
      <div className="p-3">
        <p className="text-sm font-bold text-gray-800 mb-1">{triage.reason}</p>
        <p className="text-xs text-gray-500 mb-3">{triage.department}</p>
        {triage.level !== 'self_care' && (
          <button
            onClick={onViewDoctors}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            {translations[lang].doctors.viewRecommended}
          </button>
        )}
      </div>
    </div>
  );
}

const LoginPage = ({ onLogin }: { onLogin: (name: string, gender: 'Mr.' | 'Ms.') => void }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Mr.' | 'Ms.'>('Mr.');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!inviteCode.trim() || !name.trim()) {
      setError('Please enter both invite code and name');
      return;
    }
    if (inviteCode.trim().toLowerCase() !== 'hsbc') {
      setError('wrong Invite Code');
      return;
    }
    onLogin(name, gender);
  };

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo Area */}
        <div className="mb-12 flex flex-col items-center">
          <img
            src="https://gw.alipayobjects.com/mdn/rms/afts/img/A*BAhDQLCn3-wAAAAAAAAAAAAAARQnAQ"
            alt="Logo"
            className="w-20 mb-4"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">AI Doctor</h1>
        </div>

        {/* Form Area */}
        <div className="w-full space-y-4 mb-8">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Key className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-xl py-4 pl-12 pr-4 outline-none transition-all text-gray-800"
            />
          </div>

          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <User className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-xl py-4 pl-12 pr-4 outline-none transition-all text-gray-800"
            />
          </div>

          {/* Gender Selection */}
          <div className="flex gap-3">
            <button
              onClick={() => setGender('Mr.')}
              className={`flex-1 py-3.5 rounded-xl font-bold transition-all ${gender === 'Mr.' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-gray-500'
                }`}
            >
              Mr.
            </button>
            <button
              onClick={() => setGender('Ms.')}
              className={`flex-1 py-3.5 rounded-xl font-bold transition-all ${gender === 'Ms.' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-gray-500'
                }`}
            >
              Ms.
            </button>
          </div>

          {error && <p className="text-red-500 text-[10px] text-center font-medium">{error}</p>}
        </div>

        {/* Login Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleLogin}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-100 active:bg-blue-700 transition-all"
        >
          Get Started
        </motion.button>
      </div>
    </div>
  );
};

const HospitalDetailPage = ({ hospital, lang, onClose }: { hospital: Institution, lang: Language, onClose: () => void }) => {
  const t = translations[lang].hospitals;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-white z-[130] flex flex-col"
    >
      <header className="px-4 py-4 flex items-center gap-4 border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">{hospital.name[lang]}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-8 pb-32">
        <div className="flex flex-col items-center text-center">
          <img
            src={hospital.image}
            alt={hospital.name[lang]}
            className="w-full h-48 object-cover rounded-2xl mb-6 shadow-md"
            referrerPolicy="no-referrer"
          />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{hospital.name[lang]}</h2>
          <div className="flex items-center gap-1 mb-4">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < Math.floor(hospital.rating) ? 'fill-current' : 'text-gray-200'}`} />
              ))}
            </div>
            <span className="text-sm font-bold text-gray-800 ml-1">{hospital.rating}</span>
            <span className="text-xs text-gray-400">({hospital.reviewsCount} reviews)</span>
          </div>
        </div>

        <div className="space-y-4 bg-gray-50 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t.address}</p>
              <p className="text-sm text-gray-700 font-medium">{hospital.address[lang]}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t.phone}</p>
              <p className="text-sm text-gray-700 font-medium">{hospital.phone}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t.hours}</p>
              <p className="text-sm text-gray-700 font-medium">{hospital.hours}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800 border-l-4 border-blue-600 pl-3">{t.userReviews}</h3>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-red-500">{hospital.rating}</span>
              <span className="text-xs text-gray-400">({hospital.reviewsCount} reviews)</span>
            </div>
          </div>

          {/* Simple Rating Breakdown */}
          <div className="space-y-2 mb-6">
            {[5, 4, 3, 2, 1].map(star => (
              <div key={star} className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 w-4">{star}★</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: star >= 4 ? '80%' : star === 3 ? '40%' : '5%' }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 w-4">{star >= 4 ? '2' : star === 3 ? '1' : '0'}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {hospital.reviews.map(review => (
              <div key={review.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {review.user[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{review.user}</p>
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-2.5 h-2.5 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">{review.date}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{review.text}</p>
                <div className="flex flex-wrap gap-2">
                  {review.tags.map((tag, tIdx) => (
                    <span key={`${tag}-${tIdx}`} className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 flex gap-3 bg-white fixed bottom-0 left-0 right-0 z-20">
        <button className="flex-1 py-3.5 bg-blue-50 text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 active:bg-blue-100 transition-colors">
          <Phone className="w-4 h-4" /> {translations[lang].doctors.call}
        </button>
        <button
          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.address[lang])}`, '_blank')}
          className="flex-1 py-3.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl font-bold flex items-center justify-center gap-2 active:bg-emerald-100 transition-colors"
        >
          <Navigation className="w-4 h-4" /> {t.navigate}
        </button>
        <button className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          {translations[lang].doctors.book}
        </button>
      </div>
    </motion.div>
  );
};

const HospitalMapView = ({ lang, onSelectHospital }: { lang: Language, onSelectHospital: (id: number) => void }) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedHospital = mockInstitutions.find(h => h.id === selectedId);

  return (
    <div className="relative flex-1 bg-[#e5e7eb] overflow-hidden">
      {/* Mock Map Background */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
          {/* Mock Roads */}
          <path d="M0 50 Q 50 40 100 50" stroke="white" strokeWidth="2" fill="none" />
          <path d="M50 0 Q 60 50 50 100" stroke="white" strokeWidth="2" fill="none" />
          <path d="M20 0 L 80 100" stroke="white" strokeWidth="1" fill="none" />
          {/* Mock Water */}
          <path d="M0 80 Q 30 75 50 90 T 100 85 L 100 100 L 0 100 Z" fill="#bfdbfe" />
        </svg>
      </div>

      {/* Markers */}
      {mockInstitutions.map(inst => (
        <motion.button
          key={inst.id}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setSelectedId(inst.id)}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: `${inst.coords.x}%`, top: `${inst.coords.y}%` }}
        >
          <div className={`relative flex flex-col items-center transition-transform ${selectedId === inst.id ? 'scale-125 z-20' : ''}`}>
            <div className={`p-1.5 rounded-full shadow-lg border-2 ${selectedId === inst.id ? 'bg-red-500 border-white' : 'bg-white border-red-500'}`}>
              <MapPin className={`w-5 h-5 ${selectedId === inst.id ? 'text-white' : 'text-red-500'}`} />
            </div>
            {selectedId === inst.id && (
              <div className="absolute top-full mt-1 bg-white px-2 py-1 rounded shadow-md border border-gray-100 whitespace-nowrap">
                <p className="text-[10px] font-bold text-gray-800">{inst.name[lang]}</p>
              </div>
            )}
          </div>
        </motion.button>
      ))}

      {/* Mini Detail Card */}
      <AnimatePresence>
        {selectedHospital && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-4 right-4 bg-white rounded-2xl p-4 shadow-2xl z-30 border border-gray-100"
            onClick={() => onSelectHospital(selectedHospital.id)}
          >
            <div className="flex gap-4">
              <img
                src={selectedHospital.image}
                alt={selectedHospital.name[lang]}
                className="w-20 h-20 rounded-xl object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 truncate mb-1">{selectedHospital.name[lang]}</h3>
                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-xs font-bold text-gray-800">{selectedHospital.rating}</span>
                  <span className="text-[10px] text-gray-400">({selectedHospital.reviewsCount})</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 mb-1">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span className="text-[10px] truncate">{selectedHospital.address[lang]}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-[10px]">{selectedHospital.hours}</span>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom Controls (UI Only) */}
      <div className="absolute right-4 top-4 flex flex-col gap-2 z-20">
        <button className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-gray-600 font-bold active:bg-gray-50">+</button>
        <button className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-gray-600 font-bold active:bg-gray-50">-</button>
        <button className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-blue-500 active:bg-gray-50">
          <Compass className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

const HospitalListPage = ({ lang, onClose, onSelectHospital }: {
  lang: Language,
  onClose: () => void,
  onSelectHospital: (id: number) => void
}) => {
  const t = translations[lang].hospitals;
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const categories = [
    { id: 'all', label: translations[lang].doctors.categories.all, icon: '🏥' },
    { id: 'gp', label: translations[lang].doctors.categories.gp, icon: '👨‍⚕️' },
    { id: 'dental', label: translations[lang].doctors.categories.dental, icon: '🦷' },
    { id: 'tcm', label: translations[lang].doctors.categories.tcm, icon: '🌿' },
    { id: 'gastro', label: translations[lang].doctors.categories.gastro, icon: '💪' },
  ];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-[#f8faff] z-[120] flex flex-col"
    >
      <header className="px-4 py-4 flex items-center gap-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            className="w-full bg-gray-50 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
          className="flex flex-col items-center gap-0.5"
        >
          {viewMode === 'list' ? <Map className="w-5 h-5 text-red-500" /> : <LayoutGrid className="w-5 h-5 text-blue-500" />}
          <span className="text-[10px] font-bold text-gray-600">{viewMode === 'list' ? t.mapView : t.listView}</span>
        </button>
      </header>

      {viewMode === 'list' ? (
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="sticky top-0 bg-[#f8faff] z-10 pt-4 pb-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mb-4">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${category === cat.id
                      ? 'bg-white text-red-500 border-red-500 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-100'
                    }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="px-4">
              <button className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm font-bold text-gray-600 shadow-sm">
                <span>{translations[lang].doctors.allDistricts}</span>
                <ChevronUp className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>

          <div className="px-4 pb-8">
            <p className="text-xs text-gray-400 mb-4 font-medium">{t.count(mockInstitutions.length)}</p>
            <div className="space-y-4">
              {mockInstitutions.map(inst => (
                <motion.div
                  key={inst.id}
                  onClick={() => onSelectHospital(inst.id)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-800">{inst.name[lang]}</h3>
                    <div className="flex items-center gap-1">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < Math.floor(inst.rating) ? 'fill-current' : 'text-gray-200'}`} />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-gray-400 ml-1">{inst.rating}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] font-bold rounded">general-practitioner</span>
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-bold rounded">central</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs truncate">{inst.address[lang]}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Phone className="w-3.5 h-3.5 text-gray-700" />
                      <span className="text-xs">{inst.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs">{inst.hours}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> {translations[lang].doctors.call}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inst.address[lang])}`, '_blank');
                      }}
                      className="flex-1 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Compass className="w-3.5 h-3.5" /> {t.navigate}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <HospitalMapView lang={lang} onSelectHospital={onSelectHospital} />
      )}
    </motion.div>
  );
};

const DoctorDetailPage = ({ doctor, lang, onClose }: { doctor: Doctor, lang: Language, onClose: () => void }) => {
  const t = translations[lang].doctors;
  const [selectedDate, setSelectedDate] = useState(doctor.availableSlots[0]?.date);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const currentSlots = doctor.availableSlots.find(s => s.date === selectedDate)?.slots || [];

  if (showAllReviews) {
    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 bg-white z-[120] flex flex-col"
      >
        <header className="px-4 py-4 flex items-center gap-4 border-b border-gray-100">
          <button onClick={() => setShowAllReviews(false)} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{t.patientReviews}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-2">
            <p className="text-[11px] text-amber-600 leading-relaxed text-center">
              {t.reviewsDisclaimer}
            </p>
          </div>
          {doctor.reviewsList.map(review => (
            <div key={review.id} className="bg-gray-50 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} />
                  ))}
                </div>
                <span className="text-[10px] text-gray-400">{review.time}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{review.text}</p>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-white z-[110] flex flex-col"
    >
      <header className="px-4 py-4 flex items-center gap-4 border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">{doctor.name[lang]}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-8 pb-32">
        {/* Doctor Header Info */}
        <div className="flex flex-col items-center text-center">
          <div className={`w-20 h-20 ${doctor.avatarColor} rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg`}>
            {doctor.initials}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{doctor.name[lang]}</h2>
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <span>{doctor.specialty[lang]}</span>
            <span>•</span>
            <span>{doctor.experience}{t.experience}</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-700 font-medium">{doctor.hospital[lang]}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${doctor.tier === '3A' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'
              }`}>
              {t.tiers[doctor.tier]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < Math.floor(doctor.rating) ? 'fill-current' : 'text-gray-200'}`} />
              ))}
            </div>
            <span className="text-sm font-bold text-gray-800 ml-1">{doctor.rating}</span>
            <span className="text-xs text-gray-400">({doctor.reviews} reviews)</span>
          </div>
        </div>

        {/* Video Consultation Banner */}
        {doctor.supportsVideo && (
          <div className="bg-blue-600 rounded-2xl p-4 flex items-center justify-between text-white shadow-lg shadow-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">{t.videoConsult}</h4>
                <p className="text-[10px] opacity-80">Professional online consultation</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-transform">
              {t.bookNow}
            </button>
          </div>
        )}

        {/* Rating Breakdown */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 border-l-4 border-blue-600 pl-3">评分详情 Rating Breakdown</h3>
          <div className="space-y-4">
            {Object.entries(doctor.scores).map(([key, score]) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600">{t.breakdown[key as keyof typeof doctor.scores]}</span>
                  <span className="font-bold text-blue-600">{score.toFixed(1)}/5.0</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(score / 5) * 100}%` }}
                    className="h-full bg-blue-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Patient Reviews Preview */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800 border-l-4 border-blue-600 pl-3">{t.patientReviews}</h3>
            <button
              onClick={() => setShowAllReviews(true)}
              className="text-xs text-blue-600 font-bold"
            >
              {t.viewAllReviews}
            </button>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-[10px] text-amber-600 leading-relaxed text-center">
              {t.reviewsDisclaimer}
            </p>
          </div>
          <div className="space-y-3">
            {doctor.reviewsList.slice(0, 3).map(review => (
              <div key={review.id} className="bg-gray-50 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400">{review.time}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{review.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Available Slots */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 border-l-4 border-blue-600 pl-3">{t.availableSlots}</h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {doctor.availableSlots.map(dateSlot => (
              <button
                key={dateSlot.date}
                onClick={() => setSelectedDate(dateSlot.date)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${selectedDate === dateSlot.date
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-gray-500 border-gray-100'
                  }`}
              >
                {dateSlot.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {currentSlots.map((slot, i) => (
              <button
                key={i}
                disabled={!slot.available}
                onClick={() => setSelectedSlot(slot.time)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${!slot.available
                    ? 'bg-gray-50 text-gray-300 border-transparent'
                    : selectedSlot === slot.time
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50'
                  }`}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 flex gap-3 bg-white fixed bottom-0 left-0 right-0 z-20">
        <button className="flex-1 py-3.5 border border-gray-200 rounded-2xl font-bold text-gray-700 flex items-center justify-center gap-2 active:bg-gray-50 transition-colors">
          <Phone className="w-4 h-4" /> {t.call}
        </button>
        <button className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          {t.book}
        </button>
      </div>
    </motion.div>
  );
};

const DoctorListPage = ({ lang, onClose, onSelectDoctor, triage }: {
  lang: Language,
  onClose: () => void,
  onSelectDoctor: (id: string) => void,
  triage?: ChatMessage['triage']
}) => {
  const t = translations[lang].doctors;
  const [category, setCategory] = useState('all');

  const categories = [
    { id: 'all', label: t.categories.all },
    { id: 'gp', label: t.categories.gp },
    { id: 'dental', label: t.categories.dental },
    { id: 'tcm', label: t.categories.tcm },
    { id: 'gastro', label: t.categories.gastro },
    { id: 'derm', label: t.categories.derm },
  ];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-[#f8faff] z-[100] flex flex-col"
    >
      <header className="px-4 py-4 flex items-center gap-4 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">{t.title}</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {triage && triage.level !== 'self_care' && (
          <div className="p-4">
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{t.symptomSummary}</span>
              </div>
              <p className="text-sm text-gray-700 font-medium mb-3 leading-relaxed">{triage.reason}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">{t.suggestedDept}:</span>
                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg">{triage.department}</span>
              </div>
            </div>
          </div>
        )}

        <div className="sticky top-0 bg-[#f8faff] z-10 pt-2 pb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mb-4">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${category === cat.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="px-4">
            <button className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm font-bold text-gray-600 shadow-sm">
              <span>{t.allDistricts}</span>
              <ChevronUp className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>

        <div className="px-4 space-y-4 pb-8">
          {mockDoctors.map(doctor => (
            <motion.div
              key={doctor.id}
              onClick={() => onSelectDoctor(doctor.id)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform"
            >
              <div className="flex gap-4 mb-4">
                <div className={`w-14 h-14 ${doctor.avatarColor} rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-inner`}>
                  {doctor.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-800 truncate">{doctor.name[lang]}</h3>
                    {doctor.matchScore && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg">
                        {doctor.matchScore}% {t.match}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{doctor.specialty[lang]}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 truncate">{doctor.hospital[lang]}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${doctor.tier === '3A' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'
                      }`}>
                      {t.tiers[doctor.tier]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < Math.floor(doctor.rating) ? 'fill-current' : 'text-gray-200'}`} />
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-800 ml-1">{doctor.rating}</span>
                <span className="text-[10px] text-gray-400">({doctor.reviews} reviews)</span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 flex items-center justify-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {t.call}
                </button>
                <button className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                  {t.book}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
