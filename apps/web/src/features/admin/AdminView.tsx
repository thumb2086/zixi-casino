import { useEffect, useMemo, useState, FormEvent, useCallback } from 'react';
import {
  ShieldAlert,
  Activity,
  AlertOctagon,
  Ban,
  Coins,
  Megaphone,
  Loader2,
  RefreshCw,
  Package,
  Pin,
  PinOff,
  Trash2,
  Eye,
  EyeOff,
  ScrollText,
  Inbox,
  Check,
  X,
  UserSearch,
  Sliders,
  CalendarClock,
  Gift as GiftIcon,
  Send,
  MessageCircle,
  Edit2,
} from 'lucide-react';
import AppBottomNav from '../../components/AppBottomNav';
import { api } from '../../store/api';
import { useAuthStore } from '../../store/useAuthStore';

interface OpsEvent {
  id?: string;
  channel?: string;
  severity?: string;
  kind?: string;
  message?: string;
  createdAt?: string;
  source?: string;
}

interface HealthData {
  queuedTxIntents?: number;
  pendingSettlements?: number;
  openTickets?: number;
  maintenance?: boolean;
}

interface Announcement {
  announcementId?: string;
  id?: string;
  title: string;
  content: string;
  isPinned?: boolean;
  isActive?: boolean;
  publishedAt?: string;
  createdAt?: string;
}

interface CatalogItem {
  id?: string;
  itemId: string;
  type: string;
  name: string;
  rarity: string;
  source?: string;
  description?: string | null;
  icon?: string | null;
  price?: string | null;
  isActive?: boolean;
}

type TabId = 'dashboard' | 'maintenance' | 'usermgr' | 'catalog' | 'submissions' | 'campaigns' | 'tickets';

const TABS: { id: TabId; label: string; icon: typeof ShieldAlert }[] = [
  { id: 'dashboard', label: '?ÄË°®Êùø', icon: Activity },
  { id: 'maintenance', label: 'Á∂≠Ë≠∑', icon: AlertOctagon },
  { id: 'usermgr', label: '‰ΩøÁî®?ÖÁÆ°??, icon: UserSearch },
  { id: 'catalog', label: '?éÂãµ?ÆÈ?', icon: Package },
  { id: 'submissions', label: '?ïÁ®øÂØ©Ê†∏', icon: Inbox },
  { id: 'campaigns', label: 'Ê¥ªÂ?', icon: CalendarClock },
  { id: 'tickets', label: 'Â∑•ÂñÆ', icon: MessageCircle },
];

const RARITY_LABEL: Record<string, string> = {
  common: '?ÆÈÄ?,
  rare: 'Á®Ä??,
  epic: '?≤Ë©©',
  legendary: '?≥Ë™™',
  mythic: 'Á•ûË©±',
  vip: 'VIP',
};

const TYPE_LABEL: Record<string, string> = {
  avatar: '?≠Â?',
  title: 'Á®±Ë?',
  buff: 'Â¢ûÁ?',
  chest: 'ÂØ∂ÁÆ±',
  key: '?∞Â?',
  collectible: '?∂Ë?',
};

export default function AdminView() {
  const { sessionId, isAuthorized } = useAuthStore();

  const [authErr, setAuthErr] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  const [blacklistAddress, setBlacklistAddress] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');

  const [adjustAddress, setAdjustAddress] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustToken, setAdjustToken] = useState<'zhixi' | 'yjc'>('zhixi');
  const [adjustReason, setAdjustReason] = useState('');

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementPinned, setAnnouncementPinned] = useState(false);

  const [catalogItemId, setCatalogItemId] = useState('');
  const [catalogType, setCatalogType] = useState<'avatar' | 'title' | 'buff' | 'chest' | 'key' | 'collectible'>('avatar');
  const [catalogName, setCatalogName] = useState('');
  const [catalogRarity, setCatalogRarity] = useState<'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'vip'>('common');
  const [catalogIcon, setCatalogIcon] = useState('');
  const [catalogDescription, setCatalogDescription] = useState('');

  const [userQueryAddress, setUserQueryAddress] = useState('');
  const [userInspect, setUserInspect] = useState<any>(null);
  const [userInspectErr, setUserInspectErr] = useState<string | null>(null);
  const [userBiasInput, setUserBiasInput] = useState('');

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignDraftId, setCampaignDraftId] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignIsActive, setCampaignIsActive] = useState(true);
  const [campaignStartAt, setCampaignStartAt] = useState('');
  const [campaignEndAt, setCampaignEndAt] = useState('');
  const [campaignClaimLimit, setCampaignClaimLimit] = useState('1');
  const [campaignRewardZxc, setCampaignRewardZxc] = useState('');
  const [campaignRewardYjc, setCampaignRewardYjc] = useState('');
  const [campaignRewardItemId, setCampaignRewardItemId] = useState('');
  const [campaignRewardItemQty, setCampaignRewardItemQty] = useState('1');
  const [campaignRewardAvatarId, setCampaignRewardAvatarId] = useState('');
  const [campaignRewardTitleId, setCampaignRewardTitleId] = useState('');

  const [grantAddress, setGrantAddress] = useState('');
  const [grantZxc, setGrantZxc] = useState('');
  const [grantYjc, setGrantYjc] = useState('');
  const [grantItemId, setGrantItemId] = useState('');
  const [grantItemQty, setGrantItemQty] = useState('1');
  const [grantAvatarId, setGrantAvatarId] = useState('');
  const [grantTitleId, setGrantTitleId] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [allItemsList, setAllItemsList] = useState<Array<{ id: string; name?: string; icon?: string; rarity?: string; type?: string }>>([]);
  const [allAvatars, setAllAvatars] = useState<Array<{ id: string; name?: string; icon?: string }>>([]);
  const [allTitles, setAllTitles] = useState<Array<{ id: string; name?: string; icon?: string }>>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<Array<{ address: string; displayName?: string; username?: string }>>([]);

  const CHEST_KEY_ITEMS = [
    { id: 'chest_key_common', name: '?ÆÈÄöÂØ∂ÁÆ±Èë∞??, icon: '??Ô∏?, rarity: 'common', type: 'chest_key' },
    { id: 'chest_key_rare', name: 'Á®Ä?âÂØ∂ÁÆ±Èë∞??, icon: '??Ô∏?, rarity: 'rare', type: 'chest_key' },
    { id: 'chest_key_epic', name: '?≤Ë©©ÂØ∂ÁÆ±?∞Â?', icon: '??Ô∏?, rarity: 'epic', type: 'chest_key' },
    { id: 'chest_key_legendary', name: '?≥Â?ÂØ∂ÁÆ±?∞Â?', icon: '??Ô∏?, rarity: 'legendary', type: 'chest_key' },
    { id: 'chest_key_mythic', name: 'Á•ûË©±ÂØ∂ÁÆ±?∞Â?', icon: '??Ô∏?, rarity: 'mythic', type: 'chest_key' },
  ];

  useEffect(() => {
    if (activeTab !== 'usermgr' && activeTab !== 'campaigns') return;
    Promise.all([
      api.get('/api/v1/chests/items').catch(() => null),
      api.get('/api/v1/rewards/catalog').catch(() => null),
    ]).then(([chestRes, catRes]) => {
      const chestItems: Array<{ id: string; name: string; icon: string; rarity: string; type: string }> = chestRes?.data?.data ?? [];
      const catData = catRes?.data?.data ?? {};
      const catAvatarsMap = new Map<string, { id: string; name?: string; icon?: string }>();
      const catTitlesMap = new Map<string, { id: string; name?: string; icon?: string }>();
      for (const a of (catData.avatars ?? [])) catAvatarsMap.set(a.id, a);
      for (const t of (catData.titles ?? [])) catTitlesMap.set(t.id, t);
      const mergedItems: Record<string, typeof chestItems[0]> = {};
      for (const item of chestItems) {
        mergedItems[item.id] = item;
        if (item.type === 'avatar' && !catAvatarsMap.has(item.id)) {
          catAvatarsMap.set(item.id, { id: item.id, name: item.name, icon: item.icon });
        }
        if (item.type === 'title' && !catTitlesMap.has(item.id)) {
          catTitlesMap.set(item.id, { id: item.id, name: item.name, icon: item.icon });
        }
      }
      setAllItemsList([...Object.values(mergedItems), ...CHEST_KEY_ITEMS]);
      setAllAvatars(Array.from(catAvatarsMap.values()));
      setAllTitles(Array.from(catTitlesMap.values()));
    });
    api.get('/api/v1/admin/users', { params: { limit: 200 } }).then((res) => {
      setUserResults(res.data?.data?.users ?? []);
    }).catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'usermgr') {
      setUserResults([]);
      return;
    }
    if (!userSearch.trim()) {
      setUserResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get('/api/v1/admin/users', { params: { search: userSearch, limit: 20 } }).then((res) => {
        setUserResults(res.data?.data?.users ?? []);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const showUserDropdown = userResults.length > 0;

  // Tickets (support)
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('');
  const [ticketKeyword, setTicketKeyword] = useState('');
  const [ticketReplyDraft, setTicketReplyDraft] = useState<Record<string, string>>({});

  // Blacklist list + win-bias quick view
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [winBiasView, setWinBiasView] = useState<number | null | undefined>(undefined);

  const [actionResult, setActionResult] = useState<string | null>(null);

  async function refresh() {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [healthRes, eventsRes, annRes, catRes, subsRes, campRes] = await Promise.all([
        api.get('/api/v1/admin/ops/health').catch((err) => {
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            setAuthErr('‰Ω†‰??ØÁÆ°?ÜÂì°?ñÊú™?ªÂÖ•');
          }
          return null;
        }),
        api.get('/api/v1/admin/ops/events?limit=50').catch(() => null),
        api.get('/api/v1/admin/announcements').catch(() => null),
        api.get('/api/v1/admin/reward-catalog').catch(() => null),
        api.get('/api/v1/admin/submissions').catch(() => null),
        api.get('/api/v1/admin/campaigns').catch(() => null),
      ]);
      if (healthRes?.data?.data) {
        const h = healthRes.data.data;
        setHealth(h);
        setMaintenanceOn(Boolean(h.maintenance));
      }

      // Surface admin auth failures clearly. The admin GET endpoints return
      // { error: { code: "UNAUTHORIZED", reason, message } } when the request
      // is authenticated as a non-admin or when ADMIN_ADDRESS env is not set.
      // Without surfacing this the UI just shows "0" for every list and the
      // operator has no idea why.
      const firstErr = [annRes, catRes, subsRes, campRes, eventsRes]
        .map((r) => r?.data?.data?.error)
        .find((e) => e && e.code);
      if (firstErr) {
        const reason = firstErr.message || firstErr.reason || firstErr.code;
        setAuthErr(`ÁÆ°Á??°Ë??ôË??ñÂ§±?óÔ?${reason}`);
      } else {
        setAuthErr(null);
      }

      if (annRes?.data?.data?.announcements) setAnnouncements(annRes.data.data.announcements);
      if (eventsRes?.data?.data?.events) setEvents(eventsRes.data.data.events);
      if (catRes?.data?.data?.items) setCatalog(catRes.data.data.items);
      if (subsRes?.data?.data?.submissions) setSubmissions(subsRes.data.data.submissions);
      if (campRes?.data?.data?.campaigns) setCampaigns(campRes.data.data.campaigns);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function refreshTickets() {
    if (!sessionId) return;
    const params: Record<string, string> = { sessionId };
    if (ticketStatusFilter) params.status = ticketStatusFilter;
    if (ticketKeyword.trim()) params.keyword = ticketKeyword.trim();
    try {
      const res = await api.get('/api/v1/admin/tickets', { params });
      if (res?.data?.data?.tickets) setTickets(res.data.data.tickets);
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function refreshBlacklist() {
    if (!sessionId) return;
    try {
      const res = await api.get('/api/v1/admin/blacklist', { params: { sessionId } });
      if (res?.data?.data?.blacklist) setBlacklist(res.data.data.blacklist);
    } catch {
      // swallow ??UI shows empty list
    }
  }

  useEffect(() => {
    if (activeTab === 'tickets') refreshTickets();
    if (activeTab === 'blacklist') refreshBlacklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function show(msg: string) {
    setActionResult(msg);
    window.setTimeout(() => setActionResult(null), 4000);
  }

  function errMsg(err: any) {
    return err?.response?.data?.data?.error?.message || err?.message || '?ç‰?Â§±Ê?';
  }

  async function handleMaintenance(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/v1/admin/maintenance', {
        sessionId,
        enabled: !maintenanceOn,
        message: maintenanceMessage || undefined,
      });
      setMaintenanceOn(!maintenanceOn);
      show(!maintenanceOn ? 'Á∂≠Ë≠∑Ê®°Â?Â∑≤Â??? : 'Á∂≠Ë≠∑Ê®°Â?Â∑≤Â???);
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleBlacklist(e: FormEvent) {
    e.preventDefault();
    if (!blacklistAddress.trim()) return;
    try {
      await api.post('/api/v1/admin/blacklist', {
        sessionId,
        address: blacklistAddress.trim(),
        reason: blacklistReason.trim() || undefined,
        action: 'add',
      });
      show(`Â∑≤Â??•È??çÂñÆÔº?{blacklistAddress}`);
      setBlacklistAddress('');
      setBlacklistReason('');
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleAdjust(e: FormEvent) {
    e.preventDefault();
    if (!adjustAddress.trim() || !adjustAmount.trim()) return;
    try {
      const res = await api.post('/api/v1/admin/adjust-balance', {
        sessionId,
        address: adjustAddress.trim(),
        amount: adjustAmount.trim(),
        token: adjustToken,
        reason: adjustReason.trim() || 'admin_adjust',
      });
      const data = res.data?.data;
      show(`È§òÈ?Â∑≤Ë™ø?¥Ô??∞È?È°çÔ?${data?.newBalance ?? '?'} ${adjustToken.toUpperCase()}`);
      setAdjustAmount('');
      setAdjustReason('');
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleAnnouncementCreate(e: FormEvent) {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) return;
    try {
      await api.post('/api/v1/admin/announcements', {
        sessionId,
        title: announcementTitle.trim(),
        content: announcementContent.trim(),
        isPinned: announcementPinned,
        isActive: true,
      });
      show(`?¨Â?Â∑≤ÁôºÂ∏ÉÔ?${announcementTitle}`);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementPinned(false);
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleAnnouncementToggle(ann: Announcement, field: 'isActive' | 'isPinned') {
    const id = ann.announcementId || ann.id;
    if (!id) return;
    try {
      await api.patch(`/api/v1/admin/announcements/${encodeURIComponent(id)}`, {
        sessionId,
        [field]: !ann[field],
      });
      show(`Â∑≤Êõ¥?∞ÂÖ¨?äÔ?${ann.title}`);
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleAnnouncementDelete(ann: Announcement) {
    const id = ann.announcementId || ann.id;
    if (!id) return;
    if (!window.confirm(`Á¢∫Â??™Èô§?¨Â???{ann.title}?çÔ?`)) return;
    try {
      await api.delete(`/api/v1/admin/announcements/${encodeURIComponent(id)}`, { data: { sessionId } });
      show('?¨Â?Â∑≤Âà™??);
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleCatalogCreate(e: FormEvent) {
    e.preventDefault();
    const name = catalogName.trim();
    if (!name) return;
    const autoId = catalogItemId.trim() || `admin_${catalogType}_${Date.now().toString(36)}`;
    try {
      await api.post('/api/v1/admin/reward-catalog', {
        sessionId,
        itemId: autoId,
        type: catalogType,
        name,
        rarity: catalogRarity,
        source: 'admin',
        description: catalogDescription.trim() || undefined,
        icon: catalogIcon.trim() || undefined,
        isActive: true,
      });
      show(`Â∑≤Êñ∞Â¢?/ ?¥Êñ∞Ôº?{name}Ôº?{autoId}Ôºâ`);
      setCatalogItemId('');
      setCatalogName('');
      setCatalogIcon('');
      setCatalogDescription('');
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleCatalogToggle(item: CatalogItem) {
    try {
      await api.patch(`/api/v1/admin/reward-catalog/${encodeURIComponent(item.itemId)}`, {
        sessionId,
        isActive: !item.isActive,
      });
      show(`Â∑≤Êõ¥?∞Ô?${item.name}`);
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleCatalogDelete(item: CatalogItem) {
    if (!window.confirm(`Á¢∫Â??™Èô§??{item.name}?çÔ?`)) return;
    try {
      await api.delete(`/api/v1/admin/reward-catalog/${encodeURIComponent(item.itemId)}`, { data: { sessionId } });
      show('Â∑≤Âà™??);
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleSubmissionApprove(sub: any) {
    if (!window.confirm(`Á¢∫Â??öÈ???{sub.name}?çÔ??öÈ?ÂæåÊ??†ÂÖ•?∞Á®±?üÈ†≠?èÊ??Æ`)) return;
    try {
      await api.post(`/api/v1/admin/submissions/${encodeURIComponent(sub.submissionId)}/approve`, { sessionId });
      show('Â∑≤ÈÄöÈ?');
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleSubmissionReject(sub: any) {
    const reason = window.prompt('?íÁ??üÂ?ÔºàÂèØ?ôÁ©∫ÔºâÔ?') ?? '';
    if (!window.confirm(`Á¢∫Â??íÁ???{sub.name}?çÔ?`)) return;
    try {
      await api.post(`/api/v1/admin/submissions/${encodeURIComponent(sub.submissionId)}/reject`, {
        sessionId,
        reviewNote: reason,
      });
      show('Â∑≤Ê?Áµ?);
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleUserInspect() {
    setUserInspectErr(null);
    setUserInspect(null);
    const addr = userQueryAddress.trim();
    if (!addr) {
      setUserInspectErr('Ë´ãËº∏?•Âú∞?Ä');
      return;
    }
    try {
      const res = await api.get(`/api/v1/admin/users/${encodeURIComponent(addr)}`);
      const data = res.data?.data;
      if (!data || !data.user) {
        setUserInspectErr('?•ÁÑ°‰ΩøÁî®??);
        return;
      }
      setUserInspect(data);
      setUserBiasInput(
        data.profile?.winBias != null ? String(data.profile.winBias) : '',
      );
    } catch (err: any) {
      setUserInspectErr(errMsg(err));
    }
  }

  async function handleSetWinBias() {
    if (!userInspect?.user?.address) return;
    const raw = userBiasInput.trim();
    let bias: number | null;
    if (raw === '') {
      bias = null;
    } else {
      bias = Number(raw);
      if (!Number.isFinite(bias) || bias < 0 || bias > 1) {
        show('?ùÁ??èÁΩÆÂøÖÈ?‰ªãÊñº 0 ??1 ‰πãÈ?ÔºåÁ?Á©∫Â?Ê∏ÖÈô§');
        return;
      }
    }
    try {
      await api.post(
        `/api/v1/admin/users/${encodeURIComponent(userInspect.user.address)}/win-bias`,
        { sessionId, bias },
      );
      show(bias === null ? 'Â∑≤Ê??§Â??áÂ?ÁΩ? : `Â∑≤Ë®≠ÂÆöÂ??áÂ?ÁΩ?${bias}`);
      handleUserInspect();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleClearWinBias() {
    if (!userInspect?.user?.address) return;
    try {
      await api.delete(
        `/api/v1/admin/users/${encodeURIComponent(userInspect.user.address)}/win-bias`,
        { data: { sessionId } },
      );
      setUserBiasInput('');
      show('Â∑≤Ê??§Â??áÂ?ÁΩ?);
      handleUserInspect();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleSetVipLevel(level: number) {
    if (!userInspect?.user?.address) return;
    try {
      await api.post(
        `/api/v1/admin/users/${encodeURIComponent(userInspect.user.address)}/vip`,
        { sessionId, level },
      );
      show(`Â∑≤Ë®≠ÂÆ?VIP Á≠âÁ???${level}`);
      handleUserInspect();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleResetTotalBet() {
    if (!userInspect?.user?.address) return;
    if (!window.confirm('Á¢∫Â?Ë¶ÅÊ??ô‰?‰ΩøÁî®?ÖÁ?Á¥ØÁ?‰∏ãÊ≥®Ê≠∏Èõ∂?éÔ?')) return;
    try {
      await api.post(
        `/api/v1/admin/users/${encodeURIComponent(userInspect.user.address)}/reset-total-bet`,
        { sessionId },
      );
      show('Á¥ØÁ?‰∏ãÊ≥®Â∑≤Ê≠∏??);
      handleUserInspect();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleCampaignSave() {
    const title = campaignTitle.trim();
    if (!title) {
      show('Ë´ãËº∏?•Ê¥ª?ïÂ?Á®?);
      return;
    }
    const rewards: any = {};
    if (campaignRewardZxc.trim()) {
      const n = Number(campaignRewardZxc);
      if (Number.isFinite(n) && n > 0) rewards.zxc = n;
    }
    if (campaignRewardYjc.trim()) {
      const n = Number(campaignRewardYjc);
      if (Number.isFinite(n) && n > 0) rewards.yjc = n;
    }
    if (campaignRewardItemId.trim()) {
      rewards.items = [{ id: campaignRewardItemId.trim(), qty: Math.max(1, Number(campaignRewardItemQty) || 1) }];
    }
    if (campaignRewardAvatarId.trim()) {
      rewards.avatars = [campaignRewardAvatarId.trim()];
    }
    if (campaignRewardTitleId.trim()) {
      rewards.titles = [campaignRewardTitleId.trim()];
    }
    try {
      const res = await api.post('/api/v1/admin/campaigns', {
        sessionId,
        campaignId: campaignDraftId.trim() || undefined,
        title,
        description: campaignDescription.trim() || undefined,
        isActive: campaignIsActive,
        startAt: campaignStartAt ? new Date(campaignStartAt).toISOString() : null,
        endAt: campaignEndAt ? new Date(campaignEndAt).toISOString() : null,
        claimLimitPerUser: Number(campaignClaimLimit || '1'),
        maxClaimsPerUser: Number(campaignClaimLimit || '1'),
        rewards,
      });
      const data = res.data?.data;
      if (data?.error) throw new Error(data.error.message || data.error.code || '?≤Â?Â§±Ê?');
      show('Ê¥ªÂ?Â∑≤ÂÑ≤Â≠?);
      setCampaignDraftId('');
      setCampaignTitle('');
      setCampaignDescription('');
      setCampaignStartAt('');
      setCampaignEndAt('');
      setCampaignRewardZxc('');
      setCampaignRewardYjc('');
      setCampaignRewardItemId('');
      setCampaignRewardItemQty('1');
      setCampaignRewardAvatarId('');
      setCampaignRewardTitleId('');
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleCampaignToggle(c: any) {
    try {
      // Preserve startAt / endAt / requiredLevel when toggling isActive ??without
      // these the backend upsert stores null and wipes the time window.
      await api.post('/api/v1/admin/campaigns', {
        sessionId,
        campaignId: c.campaignId,
        title: c.title,
        description: c.description ?? undefined,
        isActive: !c.isActive,
        maxClaimsPerUser: c.maxClaimsPerUser ?? 1,
        rewards: c.rewards ?? {},
        startAt: c.startAt ?? null,
        endAt: c.endAt ?? null,
        requiredLevel: c.requiredLevel ?? undefined,
      });
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleCampaignDelete(campaignId: string) {
    if (!confirm('Á¢∫Â??™Èô§?ôÂÄãÊ¥ª?ïÂ?Ôº?)) return;
    try {
      await api.delete(`/api/v1/admin/campaigns/${encodeURIComponent(campaignId)}`);
      show('Â∑≤Âà™??);
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleGrantSubmit() {
    const addr = grantAddress.trim();
    if (!addr) {
      show('Ë´ãËº∏?•‰Ωø?®ËÄÖÂú∞?Ä');
      return;
    }
    const body: any = { sessionId, address: addr, note: grantNote.trim() || undefined };
    if (grantZxc.trim()) {
      const n = Number(grantZxc);
      if (Number.isFinite(n)) body.zxc = n;
    }
    if (grantYjc.trim()) {
      const n = Number(grantYjc);
      if (Number.isFinite(n)) body.yjc = n;
    }
    const items: any[] = [];
    if (grantItemId.trim()) {
      items.push({ id: grantItemId.trim(), qty: Math.max(1, Number(grantItemQty || '1')) });
    }
    if (items.length) body.items = items;
    if (grantAvatarId.trim()) body.avatars = [grantAvatarId.trim()];
    if (grantTitleId.trim()) body.titles = [grantTitleId.trim()];

    if (!body.zxc && !body.yjc && !body.items && !body.avatars && !body.titles) {
      show('Ë´ãËá≥Â∞ëÂ°´‰∏Ä?ãÁ??µÊ?‰Ω?);
      return;
    }
    try {
      const res = await api.post('/api/v1/admin/grant', body);
      const data = res.data?.data;
      if (data?.error) throw new Error(data.error.message || data.error.code || 'Ë¥àÈÄÅÂ§±??);
      show(`??Â∑≤ÈÄÅÂá∫?éÂãµÁµ?${addr}`);
      setGrantZxc('');
      setGrantYjc('');
      setGrantItemId('');
      setGrantItemQty('1');
      setGrantAvatarId('');
      setGrantTitleId('');
      setGrantNote('');
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  const healthCards = useMemo(
    () => [
      { label: 'ÂæÖË??Ü‰∫§??, value: health?.queuedTxIntents ?? '-' },
      { label: 'ÂæÖÁ?ÁÆóÊï∏', value: health?.pendingSettlements ?? '-' },
      { label: '?™Á?Â∑•ÂñÆ', value: health?.openTickets ?? '-' },
      { label: 'Á∂≠Ë≠∑?Ä??, value: maintenanceOn ? '?üÁî®‰∏? : '?úÈ?' },
    ],
    [health, maintenanceOn],
  );

  const avatarsAndTitles = useMemo(
    () => catalog.filter((c) => c.type === 'avatar' || c.type === 'title'),
    [catalog],
  );

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-xl border-b border-[#494847]/15">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-[#fcc025]" />
            <h1 className="font-extrabold tracking-tight text-xl text-[#fcc025] uppercase italic">ÁÆ°Á?‰∏≠Â?</h1>
          </div>
          <button onClick={refresh} className="p-2 rounded-lg border border-[#494847]/30 hover:bg-[#262626]" aria-label="?çÊñ∞?¥Á?">
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#fcc025]' : 'text-[#adaaaa]'} />
          </button>
        </div>
      </header>

      <main className="app-shell space-y-6 pt-24">
        {!isAuthorized && (
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#fcc025]/20">
            <p className="text-sm text-[#adaaaa]">Ë´ãÂ??ªÂÖ•‰ª•‰Ωø?®ÁÆ°?ÜÂ??Ω„Ä?/p>
          </section>
        )}

        {authErr && (
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-red-500/20">
            <p className="text-sm text-red-400">{authErr}</p>
          </section>
        )}

        {/* Tab bar */}
        <nav className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black tracking-wide transition-all ${
                  active
                    ? 'bg-[#fcc025] text-black'
                    : 'border border-[#494847]/30 bg-[#1a1919] text-[#adaaaa]'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {actionResult && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#1a1919] border border-[#fcc025]/40 shadow-lg shadow-black/50 text-sm font-bold text-white animate-[fadeIn_0.3s_ease-out] whitespace-nowrap">
            {actionResult}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <section className="space-y-6">
            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-[#fcc025]" />
                <h3 className="text-sm font-black tracking-wide text-white">Á≥ªÁµ±?Ä??/h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {healthCards.map((s) => (
                  <div key={s.label} className="bg-[#1a1919] rounded-2xl p-4 border border-[#494847]/20">
                    <p className="text-xs font-black tracking-wide text-[#adaaaa]">{s.label}</p>
                    <p className="text-2xl font-black italic tracking-tighter text-[#fcc025] mt-2">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ScrollText size={18} className="text-[#fcc025]" />
                  <h3 className="text-sm font-black tracking-wide text-white">‰∫ã‰ª∂Á¥Ä?ÑÔ?{events.length}Ôº?/h3>
                </div>
                <button type="button" onClick={refresh} className="text-xs text-[#fcc025] hover:underline">?çÊñ∞?¥Á?</button>
              </div>
              {loading && events.length === 0 ? (
                <div className="flex items-center gap-2 text-[#adaaaa] text-xs"><Loader2 size={12} className="animate-spin" /> ËºâÂÖ•‰∏?..</div>
              ) : events.length === 0 ? (
                <p className="text-xs text-[#adaaaa]">Ê≤íÊ?‰∫ã‰ª∂</p>
              ) : (
                <ul className="space-y-2 text-xs max-h-96 overflow-y-auto">
                  {events.map((evt, i) => (
                    <li key={evt.id || i} className="border-l-2 border-[#fcc025]/40 pl-3 py-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-black uppercase px-1 rounded ${evt.severity === 'error' ? 'bg-red-500/10 text-red-400' : evt.severity === 'warn' || evt.severity === 'important' ? 'bg-[#fcc025]/10 text-[#fcc025]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {({ error: '?ØË™§', warn: 'Ë≠¶Â?', info: 'Ë≥áË?', important: '?çË?' } as Record<string, string>)[evt.severity] || evt.severity || 'Ë≥áË?'}
                        </span>
                        <span className="text-xs font-bold text-[#adaaaa]">
                          {({
                            'rewards/item_pawned': '?ìÂÖ∑?∏Áï∂',
                            'rewards/chests_opened_bulk': 'Â§ßÈ??ãÁÆ±',
                            'rewards/chests_opened': '?ãÁÆ±',
                            'wallet/airdrop_claimed': 'Á©∫Ê??òÂ?',
                            'wallet/zxc_to_yjc_confirmed': 'ZXC?íYJC ?åÊ?',
                            'wallet/transfer': 'ËΩâÂ∏≥',
                            'game/play_completed': '?äÊà≤ÁµêÁ?',
                            'admin/campaign_upsert': 'Ê¥ªÂ??∞Â?',
                            'admin/grant': 'ÁÆ°Á??°Ë???,
                            'admin/maintenance': 'Á∂≠Ë≠∑Ê®°Â?ËÆäÊõ¥',
                            'admin/blacklist': 'ÈªëÂ??ÆË???,
                            'admin/announcement': '?¨Â??∞Â?',
                            'admin/reward_catalog': '?éÂãµ?ÆÈ?ËÆäÊõ¥',
                            'admin/submission': '?ïÁ®øÂØ©Ê†∏',
                            'support/ticket_created': 'Â∑•ÂñÆÂª∫Á?',
                            'support/ticket_updated': 'Â∑•ÂñÆ?¥Êñ∞',
                          })[`${evt.channel}/${evt.kind}`] || `${evt.channel}/${evt.kind}`}
                        </span>
                      </div>
                      <p className="text-white mt-1 text-xs break-words">
                        {(() => {
                          const msgLabels: Record<string, (m: string) => string> = {
                            'rewards/chests_opened_bulk': (m) => {
                              const match = m.match(/Opened (\d+) x (\w+) chests/);
                              return match ? `Â§ßÈ??ãÁÆ± ${match[1]} x ${match[2]} ÂØ∂ÁÆ±` : m;
                            },
                            'rewards/chests_opened': (m) => {
                              const match = m.match(/Opened (\w+) chest/);
                              return match ? `?ãÂ? ${match[1]} ÂØ∂ÁÆ±` : m;
                            },
                            'rewards/item_pawned': (m) => {
                              const match = m.match(/Pawned (\d+)x (\w+) for ([\d.]+) ZXC/);
                              return match ? `?∏Áï∂ ${match[2]} x${match[1]}ÔºåÁç≤Âæ?${match[3]} ZXC` : m;
                            },
                            'game/play_completed': (m) => {
                              const match = m.match(/User played (\w+): bet ([\d.]+), payout ([\d.]+)/);
                              return match ? `?äÁé© ${match[1]}Ôºö‰?Ê≥?${match[2]}ÔºåÁç≤Âæ?${match[3]}` : m;
                            },
                            'wallet/transfer': (m) => m.replace('Transfer', 'ËΩâÂ∏≥'),
                            'wallet/airdrop_claimed': (m) => m.replace(/airdrop/g, 'Á©∫Ê?'),
                          };
                          const key = `${evt.channel}/${evt.kind}`;
                          const fn = msgLabels[key];
                          return fn ? fn(evt.message) : evt.message;
                        })()}
                      </p>
                      <p className="text-xs text-[#adaaaa] mt-0.5">{evt.createdAt ? new Date(evt.createdAt).toLocaleString() : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === 'maintenance' && (
          <section className="space-y-6">
            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
              <div className="flex items-center gap-2 mb-4"><AlertOctagon size={18} className="text-[#fcc025]" /><h3 className="text-sm font-black tracking-wide text-white">Á∂≠Ë≠∑Ê®°Â?</h3></div>
              <p className="text-xs text-[#adaaaa] mb-3">?üÁî®ÂæåÂ??∞Ê?È°ØÁ§∫Á∂≠Ë≠∑?öÁü•ÔºåÈòª?ãÈÄ≤Â†¥?ÇÁï∂?çÁ??ãÔ?<span className={`ml-2 font-black ${maintenanceOn ? 'text-red-400' : 'text-emerald-400'}`}>{maintenanceOn ? '?üÁî®‰∏? : '?úÈ?'}</span></p>
              <form onSubmit={handleMaintenance} className="space-y-3">
                <input type="text" value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm" placeholder="Á∂≠Ë≠∑Ë®äÊÅØÔºàÂèØ?∏Ô?" maxLength={200} />
                <button type="submit" className={`w-full py-2 rounded-lg text-xs font-black tracking-wide ${maintenanceOn ? 'bg-[#494847] text-white' : 'bg-[#fcc025] text-[#0e0e0e]'}`}>{maintenanceOn ? '?úÁî®Á∂≠Ë≠∑Ê®°Â?' : '?üÁî®Á∂≠Ë≠∑Ê®°Â?'}</button>
              </form>
            </div>
            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
              <div className="flex items-center gap-2 mb-4"><Megaphone size={18} className="text-[#fcc025]" /><h3 className="text-sm font-black tracking-wide text-white">?º‰??∞ÂÖ¨??/h3></div>
              <form onSubmit={handleAnnouncementCreate} className="space-y-3">
                <input type="text" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm" placeholder="Ê®ôÈ?" maxLength={100} />
                <textarea value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm min-h-24" placeholder="?ßÂÆπ" maxLength={2000} />
                <label className="flex items-center gap-2 text-xs text-[#adaaaa]"><input type="checkbox" checked={announcementPinned} onChange={(e) => setAnnouncementPinned(e.target.checked)} />?º‰??ÇÂç≥?òÈÅ∏?ºÊ?‰∏äÊñπ</label>
                <button type="submit" className="w-full py-2 bg-[#fcc025] text-[#0e0e0e] rounded-lg text-xs font-black tracking-wide">?º‰??¨Â?</button>
              </form>
            </div>
            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
              <h3 className="text-sm font-black tracking-wide text-white mb-4">?æÊ??¨Â?Ôºà{announcements.length}Ôº?/h3>
              {announcements.length === 0 ? (<p className="text-xs text-[#adaaaa]">?ÆÂ?Ê≤íÊ??¨Â?</p>) : (
                <ul className="space-y-3">{announcements.map((ann) => {
                  const id = ann.announcementId || ann.id || ann.title;
                  return (<li key={id} className="rounded-lg border border-[#494847]/30 bg-[#0e0e0e] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">{ann.isPinned && <Pin size={12} className="text-[#fcc025]" />}<p className={`text-sm font-bold ${ann.isActive ? 'text-white' : 'text-[#494847] line-through'}`}>{ann.title}</p></div>
                        <p className="text-xs text-[#adaaaa] mt-1 line-clamp-2 whitespace-pre-wrap">{ann.content}</p>
                        <p className="text-xs text-[#494847] mt-1">{ann.publishedAt || ann.createdAt ? new Date(ann.publishedAt || ann.createdAt!).toLocaleString() : ''}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => handleAnnouncementToggle(ann, 'isPinned')} className="p-1.5 rounded border border-[#494847]/30 hover:bg-[#1a1919]" title={ann.isPinned ? '?ñÊ??òÈÅ∏' : 'ÁΩÆÈ?'}>{ann.isPinned ? <PinOff size={14} className="text-[#fcc025]" /> : <Pin size={14} className="text-[#adaaaa]" />}</button>
                        <button onClick={() => handleAnnouncementToggle(ann, 'isActive')} className="p-1.5 rounded border border-[#494847]/30 hover:bg-[#1a1919]" title={ann.isActive ? '?±Ë?' : 'È°ØÁ§∫'}>{ann.isActive ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-[#adaaaa]" />}</button>
                        <button onClick={() => handleAnnouncementDelete(ann)} className="p-1.5 rounded border border-red-500/30 hover:bg-red-500/10" title="?™Èô§"><Trash2 size={14} className="text-red-400" /></button>
                      </div>
                    </div>
                  </li>);
                })}</ul>
              )}
            </div>
          </section>
        )}

        {activeTab === 'usermgr' && (
          <section className="space-y-6">

            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 space-y-4">
              <h3 className="text-sm font-black tracking-wide text-white">‰ΩøÁî®?ÖÊü•Ë©?/h3>
              <div className="flex gap-2">
                <input type="text" value={userQueryAddress} onChange={(e) => setUserQueryAddress(e.target.value)} placeholder="Ëº∏ÂÖ•‰ΩøÁî®?ÖÂú∞?Ä 0x..." className="flex-1 rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none" />
                <button type="button" onClick={handleUserInspect} className="rounded-lg bg-[#fcc025] px-4 text-xs font-black text-black hover:brightness-110">?•Ë©¢</button>
              </div>
              {userInspectErr && <p className="text-xs text-red-400">{userInspectErr}</p>}
              {userInspect && (
                <div className="space-y-3 rounded-lg border border-[#494847]/20 bg-[#262626] p-4">
                  <div className="text-xs text-[#adaaaa]"><span className="text-[#494847]">?∞Â?Ôº?/span><span className="font-mono text-white break-all">{userInspect.user.address}</span></div>
                  {userInspect.user.displayName && <div className="text-xs text-[#adaaaa]"><span className="text-[#494847]">È°ØÁ§∫?çÁ®±Ôº?/span><span className="text-white">{userInspect.user.displayName}</span></div>}
                  {userInspect.balances && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#1a1919] p-3">
                      <div><p className="text-xs text-[#494847]">ZXC È§òÈ?</p><p className="mt-1 font-mono text-xs text-white">{formatNumber(Number(userInspect.balances.zxc) || 0)}</p></div>
                      <div><p className="text-xs text-[#494847]">YJC È§òÈ?</p><p className="mt-1 font-mono text-xs text-white">{formatNumber(Number(userInspect.balances.yjc) || 0)}</p></div>
                      <div><p className="text-xs text-[#494847]">Á¥ØÁ?‰∏ãÊ≥®</p><p className="mt-1 font-mono text-xs text-white">{formatNumber(Number(userInspect.balances.totalBet) || 0)}</p></div>
                    </div>
                  )}
                  <div className="text-xs text-[#adaaaa]"><span className="text-[#494847]">?ÆÂ??ùÁ??èÁΩÆÔº?/span><span className="text-[#fcc025] font-black">{userInspect.profile?.winBias != null ? userInspect.profile.winBias : '?™Ë®≠ÂÆöÔ??°Á≥ªÁµ±È?Ë®≠Ô?'}</span></div>
                  <div className="flex gap-2">
                    <input type="text" value={userBiasInput} onChange={(e) => setUserBiasInput(e.target.value)} placeholder="0.0 - 1.0ÔºàÁ?Á©∫Ê??§Ô?" className="flex-1 rounded-lg border border-[#494847]/30 bg-[#1a1919] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none" />
                    <button type="button" onClick={handleSetWinBias} className="flex items-center gap-1 rounded-lg bg-[#fcc025] px-3 text-xs font-black text-black hover:brightness-110"><Sliders size={12} /> Â•óÁî®</button>
                    <button type="button" onClick={handleClearWinBias} className="rounded-lg border border-[#494847]/40 bg-[#1a1919] px-3 text-xs font-black text-[#adaaaa] hover:border-red-400/60 hover:text-red-300">Ê∏ÖÈô§</button>
                  </div>
                  <div className="space-y-2 border-t border-[#494847]/20 pt-3">
                    <p className="text-xs text-[#adaaaa]">VIP Á≠âÁ?Ôº?span className="ml-1 font-black text-[#fcc025]">{typeof userInspect.vipLevel === 'number' ? userInspect.vipLevel : 0}</span></p>
                    <div className="flex flex-wrap gap-1">{[0, 1, 2, 3, 4, 5].map((lv) => (
                      <button key={lv} type="button" onClick={() => handleSetVipLevel(lv)} className={`px-3 py-1 rounded text-xs font-bold ${(userInspect.vipLevel ?? -1) === lv ? 'bg-[#fcc025] text-black' : 'bg-[#0e0e0e] text-[#adaaaa] hover:bg-[#1a1919]'}`}>T{lv}</button>
                    ))}</div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-[#494847]/20">
                    <button type="button" onClick={() => handleResetTotalBet(userInspect.user.address)} className="rounded-lg border border-red-500/30 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/10">?çË®≠‰∏ãÊ≥®Áµ±Ë?</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
              <div className="flex items-center gap-2 mb-4"><Ban size={18} className="text-[#fcc025]" /><h3 className="text-sm font-black tracking-wide text-white">ÈªëÂ???/h3></div>
              <form onSubmit={handleBlacklist} className="space-y-3">
                <input type="text" value={blacklistAddress} onChange={(e) => setBlacklistAddress(e.target.value)} className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm" placeholder="?¢Â??∞Â? 0x..." />
                <input type="text" value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm" placeholder="?üÂ?ÔºàÂèØ?∏Ô?" maxLength={200} />
                <button type="submit" className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-black tracking-wide">?†ÂÖ•ÈªëÂ???/button>
              </form>
              <div className="mt-6 pt-4 border-t border-[#494847]/30">
                <div className="flex items-center justify-between mb-2"><h4 className="text-xs font-black tracking-wide text-white">?ÆÂ?ÈªëÂ??ÆÔ?{blacklist.length}Ôº?/h4><button type="button" onClick={refreshBlacklist} className="text-xs text-[#fcc025] hover:underline">?çÊñ∞?¥Á?</button></div>
                {blacklist.length === 0 ? <p className="text-xs text-[#adaaaa]">Â∞öÁÑ°ÈªëÂ??ÆÁ??Ñ„Ä?/p> : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">{blacklist.map((b: any, i: number) => (
                    <li key={b.address || b.key || i} className="flex items-center justify-between bg-[#0e0e0e] rounded-lg px-3 py-2 text-xs">
                      <div><div className="text-white font-mono">{String(b.address || b.key || '').slice(0, 10)}??/div>{b.reason && <div className="text-[#adaaaa] text-xs mt-1">{b.reason}</div>}</div>
                      <button type="button" onClick={async () => { try { await api.post('/api/v1/admin/blacklist', { sessionId, action: 'remove', address: b.address }); show('Â∑≤Áßª?§È??çÂñÆ'); refreshBlacklist(); } catch (err: any) { show(errMsg(err)); } }} className="text-xs text-red-400 hover:text-red-300">ÁßªÈô§</button>
                    </li>
                  ))}</ul>
                )}
              </div>
            </div>

            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 space-y-4">
              <div><h3 className="text-sm font-black tracking-wide text-white mb-1">Ë¥àÈÄÅÁ???/h3><p className="text-xs text-[#adaaaa]">?¥Êé•??ZXC / YJC / ?ìÂÖ∑ / Á®±Ë? / ?≠Â?Áµ¶Ê?ÂÆö‰Ωø?®ËÄ?/p></div>
              <div className="relative">
                <input type="text" value={grantAddress} onChange={(e) => { setGrantAddress(e.target.value); setUserSearch(e.target.value); }} placeholder="?úÂ?‰ΩøÁî®?ÖÂ?Á®±Ê??∞Â?..." className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none" />
                {userResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[#494847]/30 bg-[#1a1919] shadow-xl">
                    {userResults.map((u) => (<button key={u.address} type="button" onClick={() => { setGrantAddress(u.address); setUserSearch(''); setUserResults([]); }} className="w-full px-3 py-2 text-left text-xs text-white hover:bg-[#262626] border-b border-[#494847]/10 last:border-0"><span className="font-bold">{u.displayName || u.username || '?™Áü•'}</span><span className="text-[#adaaaa] ml-2">{u.address.slice(0, 10)}...{u.address.slice(-6)}</span></button>))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={grantZxc} onChange={(e) => setGrantZxc(e.target.value)} placeholder="ZXC ?∏È?ÔºàÂèØË≤†Ô?" className="rounded-lg border border-[#494847]/30 bg-[#262626] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none" />
                <input type="number" value={grantYjc} onChange={(e) => setGrantYjc(e.target.value)} placeholder="YJC ?∏È?ÔºàÂèØË≤†Ô?" className="rounded-lg border border-[#494847]/30 bg-[#262626] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select value={grantItemId} onChange={(e) => setGrantItemId(e.target.value)} className="col-span-2 rounded-lg border border-[#494847]/30 bg-[#262626] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none">
                  <option value="">???ìÂÖ∑ ??/option>{allItemsList.filter((i) => i.type !== 'avatar' && i.type !== 'title').map((item) => (<option key={item.id} value={item.id}>{item.icon || ''} {item.name || item.id} [{item.rarity || ''}]</option>))}
                </select>
                <input type="number" min="1" value={grantItemQty} onChange={(e) => setGrantItemQty(e.target.value)} placeholder="?∏È?" className="rounded-lg border border-[#494847]/30 bg-[#262626] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none" />
              </div>
              <select value={grantAvatarId} onChange={(e) => setGrantAvatarId(e.target.value)} className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none">
                <option value="">???≠Â? ??/option>{allAvatars.map((av) => (<option key={av.id} value={av.id}>{av.icon || ''} {av.name || av.id}</option>))}
              </select>
              <select value={grantTitleId} onChange={(e) => setGrantTitleId(e.target.value)} className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none">
                <option value="">??Á®±Ë? ??/option>{allTitles.map((t) => (<option key={t.id} value={t.id}>{t.icon || ''} {t.name || t.label || t.id}</option>))}
              </select>
              <input type="text" value={grantNote} onChange={(e) => setGrantNote(e.target.value)} placeholder="?ôË®ªÔºàÈÅ∏Â°´Ô?" className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none" />
              <button type="button" onClick={handleGrantSubmit} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#fcc025] px-4 py-3 text-xs font-black text-black hover:brightness-110"><Send size={12} /> ?ÅÂá∫?éÂãµ</button>
            </div>
          </section>
        )}

        {activeTab === 'blacklist' && (
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
            <div className="flex items-center gap-2 mb-4">
              <Ban size={18} className="text-[#fcc025]" />
              <h3 className="text-sm font-black tracking-wide text-white">ÈªëÂ???/h3>
            </div>
            <form onSubmit={handleBlacklist} className="space-y-3">
              <input
                type="text"
                value={blacklistAddress}
                onChange={(e) => setBlacklistAddress(e.target.value)}
                className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm"
                placeholder="?¢Â??∞Â? 0x..."
              />
              <input
                type="text"
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm"
                placeholder="?üÂ?ÔºàÂèØ?∏Ô?"
                maxLength={200}
              />
              <button type="submit" className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-black tracking-wide">
                ?†ÂÖ•ÈªëÂ???
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-[#494847]/30">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black tracking-wide text-white">?ÆÂ?ÈªëÂ??ÆÔ?{blacklist.length}Ôº?/h4>
                <button
                  type="button"
                  onClick={refreshBlacklist}
                  className="text-xs text-[#fcc025] hover:underline"
                >
                  ?çÊñ∞?¥Á?
                </button>
              </div>
              {blacklist.length === 0 ? (
                <p className="text-xs text-[#adaaaa]">Â∞öÁÑ°ÈªëÂ??ÆÁ??Ñ„Ä?/p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {blacklist.map((b: any, i: number) => (
                    <li
                      key={b.address || b.key || i}
                      className="flex items-center justify-between bg-[#0e0e0e] rounded-lg px-3 py-2 text-xs"
                    >
                      <div>
                        <div className="text-white font-mono">
                          {String(b.address || b.key || '').slice(0, 10)}??
                        </div>
                        {b.reason && <div className="text-[#adaaaa] text-xs mt-1">{b.reason}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.post('/api/v1/admin/blacklist', {
                              sessionId,
                              action: 'remove',
                              address: b.address,
                            });
                            show('Â∑≤Áßª?§È??çÂñÆ');
                            refreshBlacklist();
                          } catch (err: any) {
                            show(errMsg(err));
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        ÁßªÈô§
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 space-y-4">
            <h3 className="text-sm font-black tracking-wide text-white">‰ΩøÁî®?ÖÊü•Ë©¢Ë??ùÁ??èÁΩÆ</h3>
            <p className="text-xs text-[#adaaaa]">
              ?•Ë©¢‰ΩøÁî®?ÖË??ô‰∏¶?ØË™ø?¥Â??áÂ?ÁΩÆÔ?0 ??1 ‰πãÈ?ÔºåË?È´ò‰ª£Ë°®Ë?ÂÆπÊ?Ë¥èÔ??ôÁ©∫?ÅÂá∫?áÊ??§Ô?
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={userQueryAddress}
                onChange={(e) => setUserQueryAddress(e.target.value)}
                placeholder="Ëº∏ÂÖ•‰ΩøÁî®?ÖÂú∞?Ä 0x..."
                className="flex-1 rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleUserInspect}
                className="rounded-lg bg-[#fcc025] px-4 text-xs font-black text-black hover:brightness-110"
              >
                ?•Ë©¢
              </button>
            </div>
            {userInspectErr && <p className="text-xs text-red-400">{userInspectErr}</p>}
            {userInspect && (
              <div className="space-y-3 rounded-lg border border-[#494847]/20 bg-[#262626] p-4">
                <div className="text-xs text-[#adaaaa]">
                  <span className="text-[#494847]">?∞Â?Ôº?/span>
                  <span className="font-mono text-white break-all">{userInspect.user.address}</span>
                </div>
                {userInspect.user.displayName && (
                  <div className="text-xs text-[#adaaaa]">
                    <span className="text-[#494847]">È°ØÁ§∫?çÁ®±Ôº?/span>
                    <span className="text-white">{userInspect.user.displayName}</span>
                  </div>
                )}
                {userInspect.balances && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#1a1919] p-3">
                    <div>
                      <p className="text-xs text-[#494847]">ZXC È§òÈ?</p>
                      <p className="mt-1 font-mono text-xs text-white">{formatNumber(Number(userInspect.balances.zxc) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#494847]">YJC È§òÈ?</p>
                      <p className="mt-1 font-mono text-xs text-white">{formatNumber(Number(userInspect.balances.yjc) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#494847]">Á¥ØÁ?‰∏ãÊ≥®</p>
                      <p className="mt-1 font-mono text-xs text-white">{formatNumber(Number(userInspect.balances.totalBet) || 0)}</p>
                    </div>
                  </div>
                )}
                <div className="text-xs text-[#adaaaa]">
                  <span className="text-[#494847]">?ÆÂ??ùÁ??èÁΩÆÔº?/span>
                  <span className="text-[#fcc025] font-black">
                    {userInspect.profile?.winBias != null ? userInspect.profile.winBias : '?™Ë®≠ÂÆöÔ??°Á≥ªÁµ±È?Ë®≠Ô?'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userBiasInput}
                    onChange={(e) => setUserBiasInput(e.target.value)}
                    placeholder="0.0 - 1.0ÔºàÁ?Á©∫Ê??§Ô?"
                    className="flex-1 rounded-lg border border-[#494847]/30 bg-[#1a1919] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSetWinBias}
                    className="flex items-center gap-1 rounded-lg bg-[#fcc025] px-3 text-xs font-black text-black hover:brightness-110"
                  >
                    <Sliders size={12} /> Â•óÁî®
                  </button>
                  <button
                    type="button"
                    onClick={handleClearWinBias}
                    className="rounded-lg border border-[#494847]/40 bg-[#1a1919] px-3 text-xs font-black text-[#adaaaa] hover:border-red-400/60 hover:text-red-300"
                  >
                    Ê∏ÖÈô§
                  </button>
                </div>

                <div className="space-y-2 border-t border-[#494847]/20 pt-3">
                  <p className="text-xs text-[#adaaaa]">
                    VIP Á≠âÁ?Ôº?
                    <span className="ml-1 font-black text-[#fcc025]">
                      {typeof userInspect.vipLevel === 'number' ? userInspect.vipLevel : 0}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {[0, 1, 2, 3, 4, 5].map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => handleSetVipLevel(lv)}
                        className="rounded-lg border border-[#494847]/30 bg-[#1a1919] px-3 py-1.5 text-xs font-black text-white hover:border-[#fcc025]/60 hover:text-[#fcc025]"
                      >
                        VIP {lv}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#494847]/20 pt-3">
                  <button
                    type="button"
                    onClick={handleResetTotalBet}
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-300 hover:bg-red-500/20"
                  >
                    Ê≠∏Èõ∂Á¥ØÁ?‰∏ãÊ≥®
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "announcement" && (
          <AnnouncementManager />
        )}
        {activeTab === 'catalog' && (
          <section className="space-y-6">
            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
              <div className="flex items-center gap-2 mb-4">
                <Package size={18} className="text-[#fcc025]" />
                <h3 className="text-sm font-black tracking-wide text-white">?∞Â? / Á∑®ËºØ Á®±Ë??ªÈ†≠??/h3>
              </div>
              <p className="text-xs text-[#adaaaa] mb-3">
                ‰ª?<code className="bg-[#0e0e0e] px-1 rounded">itemId</code> ?∫ÂîØ‰∏Ä?µÔ???id ?ÉÁõ¥?•Ë??ãÊó¢?âÈ??Æ„ÄÇÊñ∞Â¢ûÁ??ÖÁõÆ?ÉÂú®?åË™™?é‰∏≠Âø????©Â??ñÈ??çÂá∫?æ„Ä?
              </p>
              <form onSubmit={handleCatalogCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={catalogItemId}
                    onChange={(e) => setCatalogItemId(e.target.value)}
                    className="bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm"
                    placeholder="itemIdÔºàÁ?Á©∫Ëá™?ïÁî¢?üÔ?"
                  />
                  <select
                    value={catalogType}
                    onChange={(e) => setCatalogType(e.target.value as any)}
                    className="bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="avatar">?≠Â?</option>
                    <option value="title">Á®±Ë?</option>
                    <option value="buff">Â¢ûÁ?</option>
                    <option value="chest">ÂØ∂ÁÆ±</option>
                    <option value="key">?∞Â?</option>
                    <option value="collectible">?∂Ë?</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={catalogName}
                  onChange={(e) => setCatalogName(e.target.value)}
                  className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm"
                  placeholder="È°ØÁ§∫?çÁ®±Ôºà‰∏≠??okÔº?
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={catalogRarity}
                    onChange={(e) => setCatalogRarity(e.target.value as any)}
                    className="bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(RARITY_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={catalogIcon}
                    onChange={(e) => setCatalogIcon(e.target.value)}
                    className="bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm"
                    placeholder="Emoji / ?ñÁ§∫ÔºàÂèØ?∏Ô?"
                  />
                </div>
                <textarea
                  value={catalogDescription}
                  onChange={(e) => setCatalogDescription(e.target.value)}
                  className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm min-h-16"
                  placeholder="Ë™™Ê?ÔºàÂèØ?∏Ô?"
                  maxLength={500}
                />
                <button type="submit" className="w-full py-2 bg-[#fcc025] text-[#0e0e0e] rounded-lg text-xs font-black tracking-wide">
                  ?≤Â??ÖÁõÆ
                </button>
              </form>
            </div>

            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
              <h3 className="text-sm font-black tracking-wide text-white mb-4">
                Â∑≤Áôª?ÑÁ??™Ë?Á®±Ë? / ?≠Â?Ôºà{avatarsAndTitles.length}Ôº?
              </h3>
              {avatarsAndTitles.length === 0 ? (
                <p className="text-xs text-[#adaaaa]">?ÆÂ?Ê≤íÊ??™Ë??ÖÁõÆ</p>
              ) : (
                <ul className="space-y-2">
                  {avatarsAndTitles.map((item) => (
                    <li key={item.itemId} className="rounded-lg border border-[#494847]/30 bg-[#0e0e0e] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.icon || (item.type === 'avatar' ? '?ë§' : '?è∑Ô∏?)}</span>
                            <p className={`text-sm font-bold ${item.isActive ? 'text-white' : 'text-[#494847] line-through'}`}>
                              {item.name}
                            </p>
                            <span className="text-xs font-black tracking-widest uppercase text-[#fcc025]">
                              {TYPE_LABEL[item.type] || item.type} ¬∑ {RARITY_LABEL[item.rarity] || item.rarity}
                            </span>
                          </div>
                          <p className="text-xs text-[#494847] mt-1">id: {item.itemId}</p>
                          {item.description && (
                            <p className="text-xs text-[#adaaaa] mt-1 line-clamp-2">{item.description}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => handleCatalogToggle(item)}
                            className="p-1.5 rounded border border-[#494847]/30 hover:bg-[#1a1919]"
                            title={item.isActive ? '?úÁî®' : '?üÁî®'}
                          >
                            {item.isActive ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-[#adaaaa]" />}
                          </button>
                          <button
                            onClick={() => handleCatalogDelete(item)}
                            className="p-1.5 rounded border border-red-500/30 hover:bg-red-500/10"
                            title="?™Èô§"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === 'submissions' && (
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
            <h3 className="text-sm font-black tracking-wide text-white mb-4">‰ΩøÁî®?ÖÊ?Á®øÔ?{submissions.length}Ôº?/h3>
            {submissions.length === 0 ? (
              <p className="text-xs text-[#adaaaa]">?ÆÂ?Ê≤íÊ??ïÁ®ø</p>
            ) : (
              <ul className="space-y-3">
                {submissions.map((sub) => (
                  <li
                    key={sub.submissionId}
                    className="rounded-lg border border-[#494847]/20 bg-[#262626] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1a1919] text-2xl">
                          {sub.icon || (sub.type === 'avatar' ? '?ë§' : '?è∑')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-white">{sub.name}</span>
                            <span className="text-xs font-bold uppercase text-[#fcc025]">
                              {sub.type === 'avatar' ? '?≠Â?' : 'Á®±Ë?'}
                            </span>
                            <span className={`text-xs font-bold uppercase ${
                              sub.status === 'pending'
                                ? 'text-[#fcc025]'
                                : sub.status === 'approved'
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}>
                              {sub.status === 'pending' ? 'ÂæÖÂØ©?? : sub.status === 'approved' ? 'Â∑≤ÈÄöÈ?' : 'Â∑≤Ê?Áµ?}
                            </span>
                            <span className="text-xs font-bold uppercase text-[#adaaaa]">
                              {RARITY_LABEL[sub.rarity] || sub.rarity}
                            </span>
                          </div>
                          {sub.description && (
                            <p className="mt-1 text-xs text-[#adaaaa] break-words">{sub.description}</p>
                          )}
                          <p className="mt-1 text-xs text-[#494847] break-all">
                            ?ïÁ®ø?ÖÔ?{sub.address?.slice(0, 10)}...{sub.address?.slice(-6)}
                          </p>
                          {sub.reviewNote && (
                            <p className="mt-1 text-xs text-[#adaaaa]">ÂØ©Ê†∏?ôË®ªÔºö{sub.reviewNote}</p>
                          )}
                        </div>
                      </div>
                      {sub.status === 'pending' && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => handleSubmissionApprove(sub)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20"
                            title="?öÈ?"
                          >
                            <Check size={14} className="text-emerald-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmissionReject(sub)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20"
                            title="?íÁ?"
                          >
                            <X size={14} className="text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === 'campaigns' && (
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 space-y-6">
            <div>
              <h3 className="text-sm font-black tracking-wide text-white mb-1">Ê¥ªÂ?ÁÆ°Á?</h3>
              <p className="text-xs text-[#adaaaa]">
                Âª∫Á?Ê¥ªÂ?ËÆì‰Ωø?®ËÄÖÂà∞?éÂãµ?ÅÈ??ñÔ?ZXC / YJC / Á®±Ë? / ?≠Â? / ?ìÂÖ∑Ôº?
              </p>
            </div>

            <div className="rounded-lg border border-[#494847]/20 bg-[#262626] p-4 space-y-3">
              <div className="text-xs font-black text-[#fcc025]">?∞Â?ÔºèÁ∑®ËºØÊ¥ª??/div>
              <input
                type="text"
                value={campaignDraftId}
                onChange={(e) => setCampaignDraftId(e.target.value)}
                placeholder="Ê¥ªÂ? IDÔºàÁ?Á©∫Ëá™?ïÁî¢?üÔ?"
                className="w-full rounded-lg border border-[#494847]/30 bg-[#1a1919] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              />
              <input
                type="text"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="Ê¥ªÂ??çÁ®±"
                className="w-full rounded-lg border border-[#494847]/30 bg-[#1a1919] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              />
              <textarea
                value={campaignDescription}
                onChange={(e) => setCampaignDescription(e.target.value)}
                placeholder="Ê¥ªÂ?Ë™™Ê?"
                rows={4}
                className="w-full rounded-lg border border-[#494847]/30 bg-[#1a1919] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={campaignStartAt}
                  onChange={(e) => setCampaignStartAt(e.target.value)}
                  className="rounded-lg border border-[#494847]/30 bg-[#1a1919] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
                />
                <input
                  type="datetime-local"
                  value={campaignEndAt}
                  onChange={(e) => setCampaignEndAt(e.target.value)}
                  className="rounded-lg border border-[#494847]/30 bg-[#1a1919] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="1"
                  value={campaignClaimLimit}
                  onChange={(e) => setCampaignClaimLimit(e.target.value)}
                  placeholder="ÊØè‰∫∫Ê¨°Êï∏"
                  className="rounded-lg border border-[#494847]/30 bg-[#1a1919] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
                />
                <input
                  type="number"
                  value={campaignRewardZxc}
                  onChange={(e) => setCampaignRewardZxc(e.target.value)}
                  placeholder="ZXC ?éÂãµ"
                  className="rounded-lg border border-[#494847]/30 bg-[#1a1919] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
                />
                <input
                  type="number"
                  value={campaignRewardYjc}
                  onChange={(e) => setCampaignRewardYjc(e.target.value)}
                  placeholder="YJC ?éÂãµ"
                  className="rounded-lg border border-[#494847]/30 bg-[#1a1919] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={campaignRewardItemId}
                  onChange={(e) => setCampaignRewardItemId(e.target.value)}
                  className="rounded-lg border border-[#494847]/30 bg-[#1a1919] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
                >
                  <option value="">???ìÂÖ∑?éÂãµ ??/option>
                  {allItemsList
                    .filter((i) => i.type !== 'avatar' && i.type !== 'title')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.icon || ''} {item.name || item.id}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={campaignRewardItemQty}
                  onChange={(e) => setCampaignRewardItemQty(e.target.value)}
                  placeholder="?∏È?"
                  className="rounded-lg border border-[#494847]/30 bg-[#1a1919] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
                />
              </div>
              <select
                value={campaignRewardAvatarId}
                onChange={(e) => setCampaignRewardAvatarId(e.target.value)}
                className="w-full rounded-lg border border-[#494847]/30 bg-[#1a1919] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              >
                <option value="">???≠Â??éÂãµ ??/option>
                {allAvatars.map((av) => (
                  <option key={av.id} value={av.id}>
                    {av.icon || ''} {av.name || av.id}
                  </option>
                ))}
              </select>
              <select
                value={campaignRewardTitleId}
                onChange={(e) => setCampaignRewardTitleId(e.target.value)}
                className="w-full rounded-lg border border-[#494847]/30 bg-[#1a1919] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              >
                <option value="">??Á®±Ë??éÂãµ ??/option>
                {allTitles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon || ''} {t.name || t.id}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-[#adaaaa]">
                <input
                  type="checkbox"
                  checked={campaignIsActive}
                  onChange={(e) => setCampaignIsActive(e.target.checked)}
                />
                Âª∫Á?ÂæåÂç≥?üÁî®
              </label>
              <button
                type="button"
                onClick={handleCampaignSave}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#fcc025] px-3 py-2 text-xs font-black text-black hover:brightness-110"
              >
                <CalendarClock size={12} /> ?≤Â?Ê¥ªÂ?
              </button>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-black text-white">?ÆÂ?Ê¥ªÂ?Ôºà{campaigns.length}Ôº?/h4>
              {campaigns.length === 0 ? (
                <p className="text-xs text-[#adaaaa]">Â∞öÊú™Âª∫Á?‰ªª‰?Ê¥ªÂ?</p>
              ) : (
                <ul className="space-y-2">
                  {campaigns.map((c) => (
                    <li
                      key={c.campaignId}
                      className="rounded-lg border border-[#494847]/20 bg-[#262626] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-white">{c.title}</span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                c.isActive
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-[#494847]/30 text-[#adaaaa]'
                              }`}
                            >
                              {c.isActive ? '?üÁî®' : '?úÁî®'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#adaaaa] break-words">
                            ID: {c.campaignId}
                          </p>
                          {c.description && (
                            <p className="mt-1 text-xs text-[#adaaaa] break-words">
                              {c.description}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCampaignDraftId(c.campaignId);
                              setCampaignTitle(c.title || '');
                              setCampaignDescription(c.description || '');
                              setCampaignIsActive(c.isActive ?? true);
                              setCampaignStartAt(c.startAt ? (() => { const d = new Date(c.startAt); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })() : '');
                              setCampaignEndAt(c.endAt ? (() => { const d = new Date(c.endAt); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })() : '');
                              setCampaignClaimLimit(String(c.maxClaimsPerUser ?? 1));
                              const r = c.rewards || {};
                              setCampaignRewardZxc(String(r.zxc || ''));
                              setCampaignRewardYjc(String(r.yjc || ''));
                              const firstItem = (r.items || [])[0];
                              setCampaignRewardItemId(firstItem?.id || '');
                              setCampaignRewardItemQty(String(firstItem?.qty || '1'));
                              setCampaignRewardAvatarId((r.avatars || [])[0] || '');
                              setCampaignRewardTitleId((r.titles || [])[0] || '');
                            }}
                            className="rounded-lg bg-[#1a1919] p-2 hover:bg-[#fcc025]/10"
                            title="Á∑®ËºØ"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCampaignToggle(c)}
                            className="rounded-lg bg-[#1a1919] p-2 hover:bg-[#fcc025]/10"
                            title={c.isActive ? '?úÁî®' : '?üÁî®'}
                          >
                            {c.isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCampaignDelete(c.campaignId)}
                            className="rounded-lg bg-[#1a1919] p-2 hover:bg-red-500/10"
                          >
                            <Trash2 size={12} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === 'grant' && (
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 space-y-4">
            <div>
              <h3 className="text-sm font-black tracking-wide text-white mb-1">Ë¥àÈÄÅÁ???/h3>
              <p className="text-xs text-[#adaaaa]">
                ?¥Êé•??ZXC / YJC / ?ìÂÖ∑ / Á®±Ë? / ?≠Â?Áµ¶Ê?ÂÆö‰Ωø?®ËÄ?
              </p>
            </div>
            <div className="relative">
              <input
                type="text"
                value={grantAddress}
                onChange={(e) => {
                  setGrantAddress(e.target.value);
                  setUserSearch(e.target.value);
                }}
                placeholder="?úÂ?‰ΩøÁî®?ÖÂ?Á®±Ê??∞Â?..."
                className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              />
              {showUserDropdown && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[#494847]/30 bg-[#1a1919] shadow-xl">
                  {userResults.map((u) => (
                    <button
                      key={u.address}
                      type="button"
                      onClick={() => {
                        setGrantAddress(u.address);
                        setUserSearch('');
                        setUserResults([]);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-white hover:bg-[#262626] border-b border-[#494847]/10 last:border-0"
                    >
                      <span className="font-bold">{u.displayName || u.username || '?™Áü•'}</span>
                      <span className="text-[#adaaaa] ml-2">{u.address.slice(0, 10)}...{u.address.slice(-6)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={grantZxc}
                onChange={(e) => setGrantZxc(e.target.value)}
                placeholder="ZXC ?∏È?ÔºàÂèØË≤†Ô?"
                className="rounded-lg border border-[#494847]/30 bg-[#262626] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              />
              <input
                type="number"
                value={grantYjc}
                onChange={(e) => setGrantYjc(e.target.value)}
                placeholder="YJC ?∏È?ÔºàÂèØË≤†Ô?"
                className="rounded-lg border border-[#494847]/30 bg-[#262626] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={grantItemId}
                onChange={(e) => setGrantItemId(e.target.value)}
                className="col-span-2 rounded-lg border border-[#494847]/30 bg-[#262626] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              >
                <option value="">???ìÂÖ∑ ??/option>
                {allItemsList
                  .filter((i) => i.type !== 'avatar' && i.type !== 'title')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.icon || ''} {item.name || item.id} [{item.rarity || ''}]
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="1"
                value={grantItemQty}
                onChange={(e) => setGrantItemQty(e.target.value)}
                placeholder="?∏È?"
                className="rounded-lg border border-[#494847]/30 bg-[#262626] px-2 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
              />
            </div>
            <select
              value={grantAvatarId}
              onChange={(e) => setGrantAvatarId(e.target.value)}
              className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
            >
              <option value="">???≠Â? ??/option>
              {allAvatars.map((av) => (
                <option key={av.id} value={av.id}>
                  {av.icon || ''} {av.name || av.id}
                </option>
              ))}
            </select>
            <select
              value={grantTitleId}
              onChange={(e) => setGrantTitleId(e.target.value)}
              className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
            >
              <option value="">??Á®±Ë? ??/option>
              {allTitles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon || ''} {t.name || t.id}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              placeholder="?ôË®ªÔºàÈÅ∏Â°´Ô?"
              className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-xs text-white focus:border-[#fcc025] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGrantSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#fcc025] px-4 py-3 text-xs font-black text-black hover:brightness-110"
            >
              <Send size={12} /> ?ÅÂá∫?éÂãµ
            </button>
          </section>
        )}

        {activeTab === 'tickets' && (
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-[#fcc025]" />
              <h3 className="text-sm font-black tracking-wide text-white">ÂÆ¢Ê?Â∑•ÂñÆÔºà{tickets.length}Ôº?/h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
                className="bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">?Ä?âÁ???/option>
                <option value="open">ÂæÖË???/option>
                <option value="in_progress">?ïÁ?‰∏?/option>
                <option value="resolved">Â∑≤Ëß£Ê±?/option>
                <option value="closed">Â∑≤È???/option>
              </select>
              <input
                type="text"
                value={ticketKeyword}
                onChange={(e) => setTicketKeyword(e.target.value)}
                placeholder="?úÈçµÂ≠óÊ?Â∞?.."
                className="flex-1 min-w-[160px] bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={refreshTickets}
                className="rounded-lg bg-[#fcc025] px-4 text-xs font-black text-black hover:brightness-110"
              >
                ?•Ë©¢
              </button>
            </div>
            {tickets.length === 0 ? (
              <p className="text-xs text-[#adaaaa]">?ÆÂ?Ê≤íÊ?Á¨¶Â?Ê¢ù‰ª∂?ÑÂ∑•?Æ„Ä?/p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
                {tickets.map((t: any) => (
                  <li key={t.reportId} className="rounded-lg border border-[#494847]/30 bg-[#0e0e0e] p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-black text-white">{t.title || 'ÔºàÁÑ°Ê®ôÈ?Ôº?}</p>
                        <p className="text-xs text-[#adaaaa]">
                          {t.category || '?∂‰?'} ¬∑ {t.address ? `${String(t.address).slice(0, 10)}?¶` : '?øÂ?'}
                          {t.createdAt && ` ¬∑ ${new Date(t.createdAt).toLocaleString()}`}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-black uppercase tracking-wide px-2 py-1 rounded ${
                          t.status === 'open'
                            ? 'bg-red-500/20 text-red-300'
                            : t.status === 'in_progress'
                            ? 'bg-[#fcc025]/20 text-[#fcc025]'
                            : t.status === 'resolved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-[#494847]/20 text-[#adaaaa]'
                        }`}
                      >
                        {t.status === 'open'
                          ? 'ÂæÖË???
                          : t.status === 'in_progress'
                          ? '?ïÁ?‰∏?
                          : t.status === 'resolved'
                          ? 'Â∑≤Ëß£Ê±?
                          : t.status === 'closed'
                          ? 'Â∑≤È???
                          : t.status}
                      </span>
                    </div>
                    {t.message && <p className="text-xs text-white whitespace-pre-wrap break-words">{t.message}</p>}
                    {t.adminUpdate && (
                      <div className="rounded bg-[#fcc025]/10 border border-[#fcc025]/30 p-2">
                        <p className="text-xs font-black text-[#fcc025] mb-1">ÁÆ°Á??°Â?Ë¶?/p>
                        <p className="text-xs text-white whitespace-pre-wrap break-words">{t.adminUpdate}</p>
                      </div>
                    )}
                    <textarea
                      value={ticketReplyDraft[t.reportId] ?? ''}
                      onChange={(e) => setTicketReplyDraft((prev) => ({ ...prev, [t.reportId]: e.target.value }))}
                      placeholder="Ëº∏ÂÖ•?ûË??ßÂÆπ..."
                      className="w-full bg-[#1a1919] border border-[#494847]/30 rounded-lg px-3 py-2 text-xs text-white resize-y"
                      rows={2}
                    />
                    <div className="flex flex-wrap gap-2">
                      {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={async () => {
                            try {
                              await api.patch(`/api/v1/admin/tickets/${encodeURIComponent(t.reportId)}`, {
                                sessionId,
                                status: s,
                                adminUpdate: ticketReplyDraft[t.reportId] || t.adminUpdate || undefined,
                              });
                              show('Â∑•ÂñÆÂ∑≤Êõ¥??);
                              setTicketReplyDraft((prev) => ({ ...prev, [t.reportId]: '' }));
                              refreshTickets();
                            } catch (err: any) {
                              show(errMsg(err));
                            }
                          }}
                          className={`text-xs font-black px-2 py-1 rounded border ${
                            t.status === s
                              ? 'border-[#fcc025] bg-[#fcc025]/10 text-[#fcc025]'
                              : 'border-[#494847]/40 text-[#adaaaa] hover:border-[#fcc025]/60 hover:text-[#fcc025]'
                          }`}
                        >
                          {s === 'open' ? 'ÂæÖË??? : s === 'in_progress' ? '?ïÁ?‰∏? : s === 'resolved' ? 'Â∑≤Ëß£Ê±? : 'Â∑≤È???}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

      </main>

      <AppBottomNav current="none" />
    </div>
  );
}

export function AnnouncementManager() {
  const { sessionId } = useAuthStore();
  const [anns, setAnns] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ title: '', content: '', type: 'info', active: true });
  const [loading, setLoading] = useState(false);

  const fetchAnns = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/announcements');
      if (res.data?.success) setAnns(res.data.data);
    } catch {}
  }, []);

  useEffect(() => { fetchAnns(); }, [fetchAnns]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        await api.post('/api/v1/announcements/update', { sessionId, ...form, id: editing.id });
      } else {
        await api.post('/api/v1/announcements/add', { sessionId, ...form });
      }
      setEditing(null);
      setForm({ title: '', content: '', type: 'info', active: true });
      fetchAnns();
    } catch (err: any) {
      alert(err?.response?.data?.message || '?ç‰?Â§±Ê?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-[#1a1919] p-4 rounded-xl border border-[#494847]/30 space-y-3">
        <h3 className="text-sm font-black text-[#fcc025]">{editing ? 'Á∑®ËºØ?¨Â?' : '?∞Â??¨Â?'}</h3>
        <input
          value={form.title}
          onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Ê®ôÈ?"
          className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm text-white"
          required
        />
        <textarea
          value={form.content}
          onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
          placeholder="?ßÂÆπ"
          className="w-full bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm text-white min-h-[100px]"
          required
        />
        <div className="flex gap-4">
          <select
            value={form.type}
            onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
            className="bg-[#0e0e0e] border border-[#494847]/30 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="info">‰∏Ä??/option>
            <option value="warning">Á∂≠Ë≠∑</option>
            <option value="urgent">Á∑äÊÄ?/option>
          </select>
          <label className="flex items-center gap-2 text-sm text-[#adaaaa]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
            />
            ?üÁî®
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="flex-1 bg-[#fcc025] text-black font-black py-2 rounded-lg">
            {loading ? '?ïÁ?‰∏?..' : '?≤Â??¨Â?'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => { setEditing(null); setForm({ title: '', content: '', type: 'info', active: true }); }}
              className="px-4 border border-[#494847]/30 text-[#adaaaa] rounded-lg"
            >
              ?ñÊ?
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {anns.map(ann => (
          <div key={ann.id} className="bg-[#1a1919] p-3 rounded-xl border border-[#494847]/20 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-white">{ann.title}</p>
              <p className="text-xs text-[#adaaaa]">{ann.type} ¬∑ {ann.active ? 'Â∑≤Â??? : 'Â∑≤Â???}</p>
            </div>
            <button
              onClick={() => {
                setEditing(ann);
                setForm({ title: ann.title, content: ann.content, type: ann.type, active: ann.active });
              }}
              className="text-[#fcc025] text-xs font-bold border border-[#fcc025]/30 px-2 py-1 rounded"
            >
              Á∑®ËºØ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
