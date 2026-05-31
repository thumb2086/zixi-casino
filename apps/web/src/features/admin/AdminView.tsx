import { useEffect, useMemo, useState, FormEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { formatNumber } from '@repo/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';

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

const TABS: { id: TabId; icon: typeof ShieldAlert }[] = [
  { id: 'dashboard', icon: Activity },
  { id: 'maintenance', icon: AlertOctagon },
  { id: 'usermgr', icon: UserSearch },
  { id: 'catalog', icon: Package },
  { id: 'submissions', icon: Inbox },
  { id: 'campaigns', icon: CalendarClock },
  { id: 'tickets', icon: MessageCircle },
];

export default function AdminView() {
  const { t } = useTranslation();
  const { sessionId, isAuthorized } = useAuthStore();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');

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
  const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'urgent'>('info');
  const [editingAnnouncement, setEditingAnnouncement] = useState<any | null>(null);

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
    { id: 'chest_key_common', name: t('admin.chest_key_common_name'), icon: '🗝️', rarity: 'common', type: 'chest_key' },
    { id: 'chest_key_rare', name: t('admin.chest_key_rare_name'), icon: '🗝️', rarity: 'rare', type: 'chest_key' },
    { id: 'chest_key_epic', name: t('admin.chest_key_epic_name'), icon: '🗝️', rarity: 'epic', type: 'chest_key' },
    { id: 'chest_key_legendary', name: t('admin.chest_key_legendary_name'), icon: '🗝️', rarity: 'legendary', type: 'chest_key' },
    { id: 'chest_key_mythic', name: t('admin.chest_key_mythic_name'), icon: '🗝️', rarity: 'mythic', type: 'chest_key' },
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
            setAuthErr(t('admin.not_admin'));
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
        setAuthErr(t('admin.admin_data_failed_with_reason', { reason }));
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
      // swallow — UI shows empty list
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
    return err?.response?.data?.data?.error?.message || err?.message || t('admin.operation_failed');
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
      show(!maintenanceOn ? t('admin.maintenance_enabled') : t('admin.maintenance_disabled'));
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
      show(t('admin.blacklisted_with', { address: blacklistAddress }));
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
      show(t('admin.balance_adjusted_with', { balance: data?.newBalance ?? '?', token: adjustToken.toUpperCase() }));
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
      if (editingAnnouncement) {
        const aid = editingAnnouncement.announcementId || editingAnnouncement.id;
        await api.patch(`/api/v1/admin/announcements/${aid}`, {
          sessionId,
          title: announcementTitle,
          content: announcementContent,
          type: announcementType,
        });
        show(t('admin.announcement_updated', { title: announcementTitle }));
      } else {
        const res = await api.post('/api/v1/admin/announcements', {
          sessionId,
          title: announcementTitle,
          content: announcementContent,
          type: announcementType,
          isPinned: announcementPinned,
        });
        if (!res.data?.success) throw new Error(res.data?.error || t('admin.publish_failed'));
        show(t('admin.announcement_published_with', { title: announcementTitle, type: announcementType }));
      }
      setEditingAnnouncement(null);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementPinned(false);
      setAnnouncementType('info');
      refresh();
    } catch (err: any) {
      show(err?.response?.data?.message || err?.message || t('admin.operation_failed'));
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
      show(t('admin.announcement_updated', { title: ann.title }));
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleAnnouncementDelete(ann: Announcement) {
    const id = ann.announcementId || ann.id;
    if (!id) return;
    if (!window.confirm(t('admin.confirm_delete_announcement', { title: ann.title }))) return;
    try {
      await api.delete(`/api/v1/admin/announcements/${encodeURIComponent(id)}`, { data: { sessionId } });
      show(t('admin.announcement_deleted'));
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
      show(t('admin.catalog_item_saved', { name, id: autoId }));
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
      show(t('admin.catalog_item_updated', { name: item.name }));
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleCatalogDelete(item: CatalogItem) {
    if (!window.confirm(t('admin.confirm_delete_catalog', { name: item.name }))) return;
    try {
      await api.delete(`/api/v1/admin/reward-catalog/${encodeURIComponent(item.itemId)}`, { data: { sessionId } });
      show(t('admin.deleted'));
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleSubmissionApprove(sub: any) {
    if (!window.confirm(t('admin.confirm_approve_submission', { name: sub.name }))) return;
    try {
      await api.post(`/api/v1/admin/submissions/${encodeURIComponent(sub.id || sub.submissionId)}/approve`, { sessionId });
      show(t('admin.approved'));
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleSubmissionReject(sub: any) {
    const reason = window.prompt(t('admin.reject_reason_prompt')) ?? '';
    if (!window.confirm(t('admin.confirm_reject_submission', { name: sub.name }))) return;
    try {
      await api.post(`/api/v1/admin/submissions/${encodeURIComponent(sub.id || sub.submissionId)}/reject`, {
        sessionId,
        reviewNote: reason,
      });
      show(t('admin.rejected'));
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
      setUserInspectErr(t('admin.enter_address'));
      return;
    }
    try {
      const res = await api.get(`/api/v1/admin/users/${encodeURIComponent(addr)}`);
      const data = res.data?.data;
      if (!data || !data.user) {
        setUserInspectErr(t('admin.user_not_found'));
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
        show(t('admin.win_bias_range_error'));
        return;
      }
    }
    try {
      await api.post(
        `/api/v1/admin/users/${encodeURIComponent(userInspect.user.address)}/win-bias`,
        { sessionId, bias },
      );
      show(bias === null ? t('admin.win_bias_cleared') : t('admin.win_bias_set', { bias }));
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
      show(t('admin.win_bias_cleared'));
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
      show(t('admin.vip_level_set', { level }));
      handleUserInspect();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleResetTotalBet() {
    if (!userInspect?.user?.address) return;
    if (!window.confirm(t('admin.confirm_reset_total_bet'))) return;
    try {
      await api.post(
        `/api/v1/admin/users/${encodeURIComponent(userInspect.user.address)}/reset-total-bet`,
        { sessionId },
      );
      show(t('admin.total_bet_reset'));
      handleUserInspect();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleCampaignSave() {
    const title = campaignTitle.trim();
    if (!title) {
      show(t('admin.enter_campaign_title'));
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
      if (data?.error) throw new Error(data.error.message || data.error.code || t('admin.save_failed'));
      show(t('admin.campaign_saved'));
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
      // Preserve startAt / endAt / requiredLevel when toggling isActive — without
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
    if (!confirm(t('admin.confirm_delete_campaign'))) return;
    try {
      await api.delete(`/api/v1/admin/campaigns/${encodeURIComponent(campaignId)}`);
      show(t('admin.deleted'));
      refresh();
    } catch (err: any) {
      show(errMsg(err));
    }
  }

  async function handleGrantSubmit() {
    const addr = grantAddress.trim();
    if (!addr) {
      show(t('admin.enter_address'));
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
      show(t('admin.enter_at_least_one_reward'));
      return;
    }
    try {
      const res = await api.post('/api/v1/admin/grant', body);
      const data = res.data?.data;
      if (data?.error) throw new Error(data.error.message || data.error.code || t('admin.grant_failed'));
      show(t('admin.grant_sent_to', { addr }));
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
      { label: t('admin.pending_tx'), value: health?.queuedTxIntents ?? '-' },
      { label: t('admin.pending_settlements'), value: health?.pendingSettlements ?? '-' },
      { label: t('admin.open_tickets_label'), value: health?.openTickets ?? '-' },
      { label: t('admin.maintenance_status'), value: maintenanceOn ? t('admin.enabled') : t('admin.disabled') },
    ],
    [health, maintenanceOn, t],
  );

  const avatarsAndTitles = useMemo(
    () => catalog.filter((c) => c.type === 'avatar' || c.type === 'title'),
    [catalog],
  );

  return (
    <div className="min-h-screen bg-surface text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-border/15">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-accent" />
            <h1 className="font-extrabold tracking-tight text-xl text-accent uppercase italic">{t('admin.title')}</h1>
          </div>
          <button onClick={refresh} className="p-2 rounded-lg border border-border/30 hover:bg-elevated" aria-label={t('admin.refresh')}>
            <RefreshCw size={16} className={loading ? 'animate-spin text-accent' : 'text-secondary'} />
          </button>
        </div>
      </header>

      <main className="app-shell space-y-6 pt-24">
        {!isAuthorized && (
          <section className="bg-card rounded-2xl p-6 border border-accent/20">
            <p className="text-sm text-secondary">{t('admin.login_first')}</p>
          </section>
        )}

        {authErr && (
          <section className="bg-card rounded-2xl p-6 border border-red-500/20">
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
                    ? 'bg-accent text-black'
                    : 'border border-border/30 bg-card text-secondary'
                }`}
              >
                <Icon size={14} />
                {t(`admin.tab_${tab.id}`)}
              </button>
            );
          })}
        </nav>

        {actionResult && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-card border border-accent/40 shadow-lg shadow-black/50 text-sm font-bold text-white animate-[fadeIn_0.3s_ease-out] whitespace-nowrap">
            {actionResult}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <section className="space-y-6">
            <div className="bg-card rounded-2xl p-6 border border-border/20">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-accent" />
                <h3 className="text-sm font-black tracking-wide text-white">{t('admin.system_status')}</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {healthCards.map((s) => (
                  <div key={s.label} className="bg-card rounded-2xl p-4 border border-border/20">
                    <p className="text-xs font-black tracking-wide text-secondary">{s.label}</p>
                    <p className="text-2xl font-black italic tracking-tighter text-accent mt-2">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ScrollText size={18} className="text-accent" />
                  <h3 className="text-sm font-black tracking-wide text-white">{t('admin.event_log', { count: events.length })}</h3>
                </div>
                <button type="button" onClick={refresh} className="text-xs text-accent hover:underline">{t('admin.refresh')}</button>
              </div>
              {loading && events.length === 0 ? (
                <div className="flex items-center gap-2 text-secondary text-xs"><Loader2 size={12} className="animate-spin" /> {t('common.loading')}</div>
              ) : events.length === 0 ? (
                <p className="text-xs text-secondary">{t('admin.no_events')}</p>
              ) : (
                <ul className="space-y-2 text-xs max-h-96 overflow-y-auto">
                  {events.map((evt, i) => (
                    <li key={evt.id || i} className="border-l-2 border-accent/40 pl-3 py-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-black uppercase px-1 rounded ${evt.severity === 'error' ? 'bg-red-500/10 text-red-400' : evt.severity === 'warn' || evt.severity === 'important' ? 'bg-accent/10 text-accent' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {({ error: t('admin.severity_error'), warn: t('admin.severity_warn'), info: t('admin.severity_info'), important: t('admin.severity_important') } as Record<string, string>)[evt.severity] || evt.severity || t('admin.severity_info')}
                        </span>
                        <span className="text-xs font-bold text-secondary">
                          {({
                            'rewards/item_pawned': t('admin.event_rewards_item_pawned'),
                            'rewards/chests_opened_bulk': t('admin.event_rewards_chests_opened_bulk'),
                            'rewards/chests_opened': t('admin.event_rewards_chests_opened'),
                            'wallet/airdrop_claimed': t('admin.event_wallet_airdrop_claimed'),
                            'wallet/zxc_to_yjc_confirmed': t('admin.event_wallet_zxc_to_yjc_confirmed'),
                            'wallet/transfer': t('admin.event_wallet_transfer'),
                            'game/play_completed': t('admin.event_game_play_completed'),
                            'admin/campaign_upsert': t('admin.event_admin_campaign_upsert'),
                            'admin/grant': t('admin.event_admin_grant'),
                            'admin/maintenance': t('admin.event_admin_maintenance'),
                            'admin/blacklist': t('admin.event_admin_blacklist'),
                            'admin/announcement': t('admin.event_admin_announcement'),
                            'admin/reward_catalog': t('admin.event_admin_reward_catalog'),
                            'admin/submission': t('admin.event_admin_submission'),
                            'support/ticket_created': t('admin.event_support_ticket_created'),
                            'support/ticket_updated': t('admin.event_support_ticket_updated'),
                          })[`${evt.channel}/${evt.kind}`] || `${evt.channel}/${evt.kind}`}
                        </span>
                      </div>
                      <p className="text-white mt-1 text-xs break-words">
                        {(() => {
                          const msgLabels: Record<string, (m: string) => string> = {
                            'rewards/chests_opened_bulk': (m) => {
                              const match = m.match(/Opened (\d+) x (\w+) chests/);
                              return match ? t('admin.msg_chests_opened_bulk', { count: match[1], chest: match[2] }) : m;
                            },
                            'rewards/chests_opened': (m) => {
                              const match = m.match(/Opened (\w+) chest/);
                              return match ? t('admin.msg_chests_opened', { chest: match[1] }) : m;
                            },
                            'rewards/item_pawned': (m) => {
                              const match = m.match(/Pawned (\d+)x (\w+) for ([\d.]+) ZXC/);
                              return match ? t('admin.msg_item_pawned', { item: match[2], qty: match[1], amount: match[3] }) : m;
                            },
                            'game/play_completed': (m) => {
                              const match = m.match(/User played (\w+): bet ([\d.]+), payout ([\d.]+)/);
                              return match ? t('admin.msg_game_play_completed', { game: match[1], bet: match[2], payout: match[3] }) : m;
                            },
                            'wallet/transfer': (m) => m.replace('Transfer', t('admin.msg_transfer')),
                            'wallet/airdrop_claimed': (m) => m.replace(/airdrop/g, t('admin.msg_airdrop_claimed')),
                          };
                          const key = `${evt.channel}/${evt.kind}`;
                          const fn = msgLabels[key];
                          return fn ? fn(evt.message) : evt.message;
                        })()}
                      </p>
                      <p className="text-xs text-secondary mt-0.5">{evt.createdAt ? new Date(evt.createdAt).toLocaleString() : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === 'maintenance' && (
          <section className="space-y-6">
            <div className="bg-card rounded-2xl p-6 border border-border/20">
              <div className="flex items-center gap-2 mb-4"><AlertOctagon size={18} className="text-accent" /><h3 className="text-sm font-black tracking-wide text-white">{t('admin.maintenance_mode')}</h3></div>
              <p className="text-xs text-secondary mb-3">{t('admin.maintenance_desc')}<span className={`ml-2 font-black ${maintenanceOn ? 'text-red-400' : 'text-emerald-400'}`}>{maintenanceOn ? t('admin.enabled') : t('admin.disabled')}</span></p>
              <form onSubmit={handleMaintenance} className="space-y-3">
                <input type="text" value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm" placeholder={t('admin.maintenance_message_placeholder')} maxLength={200} />
                <button type="submit" className={`w-full py-2 rounded-lg text-xs font-black tracking-wide ${maintenanceOn ? 'bg-[#494847] text-white' : 'bg-accent text-[#0e0e0e]'}`}>{maintenanceOn ? t('admin.disable_maintenance') : t('admin.enable_maintenance')}</button>
              </form>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border/20">
              <div className="flex items-center gap-2 mb-4"><Megaphone size={18} className="text-accent" /><h3 className="text-sm font-black tracking-wide text-white">{editingAnnouncement ? t('admin.edit_announcement') : t('admin.new_announcement')}</h3></div>
              <form onSubmit={handleAnnouncementCreate} className="space-y-3">
                <input type="text" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm" placeholder={t('admin.announcement_title_placeholder')} maxLength={100} />
                <textarea value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm min-h-24" placeholder={t('admin.announcement_content_placeholder')} maxLength={2000} />
                <div className="flex gap-2">
                  {(['info', 'warning', 'urgent'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setAnnouncementType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${announcementType === t ? 'bg-accent text-black' : 'bg-surface text-secondary border border-border/30'}`}>{t}</button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-secondary"><input type="checkbox" checked={announcementPinned} onChange={(e) => setAnnouncementPinned(e.target.checked)} />{t('admin.pin_on_publish')}</label>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-2 bg-accent text-[#0e0e0e] rounded-lg text-xs font-black tracking-wide">{editingAnnouncement ? t('admin.update_announcement') : t('admin.publish_announcement')}</button>
                  {editingAnnouncement && (
                    <button type="button" onClick={() => { setEditingAnnouncement(null); setAnnouncementTitle(''); setAnnouncementContent(''); setAnnouncementType('info'); setAnnouncementPinned(false); }} className="px-4 border border-border/30 text-secondary rounded-lg text-xs font-black">{t('common.cancel')}</button>
                  )}
                </div>
              </form>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border/20">
              <h3 className="text-sm font-black tracking-wide text-white mb-4">{t('admin.existing_announcements', { count: announcements.length })}</h3>
              {announcements.length === 0 ? (<p className="text-xs text-secondary">{t('admin.no_announcements')}</p>) : (
                <ul className="space-y-3">{announcements.map((ann) => {
                  const id = ann.announcementId || ann.id || ann.title;
                  return (<li key={id} className="rounded-lg border border-border/30 bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">{ann.isPinned && <Pin size={12} className="text-accent" />}<p className={`text-sm font-bold ${ann.isActive ? 'text-white' : 'text-muted line-through'}`}>{ann.title}</p></div>
                        <p className="text-xs text-secondary mt-1 line-clamp-2 whitespace-pre-wrap">{ann.content}</p>
                        <p className="text-xs text-muted mt-1">{ann.publishedAt || ann.createdAt ? new Date(ann.publishedAt || ann.createdAt!).toLocaleString() : ''}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => { const a = ann as any; setEditingAnnouncement(ann); setAnnouncementTitle(a.title); setAnnouncementContent(a.content); setAnnouncementType(a.type || 'info'); setAnnouncementPinned(!!a.isPinned); }} className="p-1.5 rounded border border-accent/30 hover:bg-accent/10" title={t('admin.edit_announcement')}><Edit2 size={14} className="text-accent" /></button>
                        <button onClick={() => handleAnnouncementToggle(ann, 'isPinned')} className="p-1.5 rounded border border-border/30 hover:bg-card" title={ann.isPinned ? t('admin.unpin') : t('admin.pin')}>{ann.isPinned ? <PinOff size={14} className="text-accent" /> : <Pin size={14} className="text-secondary" />}</button>
                        <button onClick={() => handleAnnouncementToggle(ann, 'isActive')} className="p-1.5 rounded border border-border/30 hover:bg-card" title={ann.isActive ? t('admin.hide') : t('admin.show')}>{ann.isActive ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-secondary" />}</button>
                        <button onClick={() => handleAnnouncementDelete(ann)} className="p-1.5 rounded border border-red-500/30 hover:bg-red-500/10" title={t('admin.delete')}><Trash2 size={14} className="text-red-400" /></button>
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

            <div className="bg-card rounded-2xl p-6 border border-border/20 space-y-4">
              <h3 className="text-sm font-black tracking-wide text-white">{t('admin.user_query')}</h3>
              <div className="flex gap-2">
                <input type="text" value={userQueryAddress} onChange={(e) => setUserQueryAddress(e.target.value)} placeholder={t('admin.user_query_placeholder')} className="flex-1 rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none" />
                <button type="button" onClick={handleUserInspect} className="rounded-lg bg-accent px-4 text-xs font-black text-black hover:brightness-110">{t('admin.query')}</button>
              </div>
              {userInspectErr && <p className="text-xs text-red-400">{userInspectErr}</p>}
              {userInspect && (
                <div className="space-y-3 rounded-lg border border-border/20 bg-elevated p-4">
                  <div className="text-xs text-secondary"><span className="text-muted">{t('admin.address')}：</span><span className="font-mono text-white break-all">{userInspect.user.address}</span></div>
                  {userInspect.user.displayName && <div className="text-xs text-secondary"><span className="text-muted">{t('admin.display_name')}：</span><span className="text-white">{userInspect.user.displayName}</span></div>}
                  {userInspect.balances && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-card p-3">
                      <div><p className="text-xs text-muted">{t('admin.zxc_balance')}</p><p className="mt-1 font-mono text-xs text-white">{nf(Number(userInspect.balances.zxc) || 0)}</p></div>
                      <div><p className="text-xs text-muted">{t('admin.yjc_balance')}</p><p className="mt-1 font-mono text-xs text-white">{nf(Number(userInspect.balances.yjc) || 0)}</p></div>
                      <div><p className="text-xs text-muted">{t('admin.total_bet')}</p><p className="mt-1 font-mono text-xs text-white">{nf(Number(userInspect.balances.totalBet) || 0)}</p></div>
                    </div>
                  )}
                  <div className="text-xs text-secondary"><span className="text-muted">{t('admin.current_win_bias')}</span><span className="text-accent font-black">{userInspect.profile?.winBias != null ? userInspect.profile.winBias : t('admin.win_bias_not_set')}</span></div>
                  <div className="flex gap-2">
                    <input type="text" value={userBiasInput} onChange={(e) => setUserBiasInput(e.target.value)} placeholder={t('admin.win_bias_placeholder')} className="flex-1 rounded-lg border border-border/30 bg-card px-3 py-2 text-xs text-white focus:border-accent focus:outline-none" />
                    <button type="button" onClick={handleSetWinBias} className="flex items-center gap-1 rounded-lg bg-accent px-3 text-xs font-black text-black hover:brightness-110"><Sliders size={12} /> {t('admin.apply')}</button>
                    <button type="button" onClick={handleClearWinBias} className="rounded-lg border border-border/40 bg-card px-3 text-xs font-black text-secondary hover:border-red-400/60 hover:text-red-300">{t('admin.clear')}</button>
                  </div>
                  <div className="space-y-2 border-t border-border/20 pt-3">
                    <p className="text-xs text-secondary">{t('admin.vip_level')}<span className="ml-1 font-black text-accent">{typeof userInspect.vipLevel === 'number' ? userInspect.vipLevel : 0}</span></p>
                    <div className="flex flex-wrap gap-1">{[0, 1, 2, 3, 4, 5].map((lv) => (
                      <button key={lv} type="button" onClick={() => handleSetVipLevel(lv)} className={`px-3 py-1 rounded text-xs font-bold ${(userInspect.vipLevel ?? -1) === lv ? 'bg-accent text-black' : 'bg-surface text-secondary hover:bg-card'}`}>T{lv}</button>
                    ))}</div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border/20">
                    <button type="button" onClick={() => handleResetTotalBet(userInspect.user.address)} className="rounded-lg border border-red-500/30 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/10">{t('admin.reset_total_bet')}</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border/20">
              <div className="flex items-center gap-2 mb-4"><Ban size={18} className="text-accent" /><h3 className="text-sm font-black tracking-wide text-white">{t('admin.blacklist')}</h3></div>
              <form onSubmit={handleBlacklist} className="space-y-3">
                <input type="text" value={blacklistAddress} onChange={(e) => setBlacklistAddress(e.target.value)} className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm" placeholder={t('admin.blacklist_address_placeholder')} />
                <input type="text" value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm" placeholder={t('admin.blacklist_reason_placeholder')} maxLength={200} />
                <button type="submit" className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-black tracking-wide">{t('admin.add_to_blacklist')}</button>
              </form>
              <div className="mt-6 pt-4 border-t border-border/30">
                <div className="flex items-center justify-between mb-2"><h4 className="text-xs font-black tracking-wide text-white">{t('admin.current_blacklist', { count: blacklist.length })}</h4><button type="button" onClick={refreshBlacklist} className="text-xs text-accent hover:underline">{t('admin.refresh')}</button></div>
                {blacklist.length === 0 ? <p className="text-xs text-secondary">{t('admin.no_blacklist_records')}</p> : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">{blacklist.map((b: any, i: number) => (
                    <li key={b.address || b.key || i} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-xs">
                      <div><div className="text-white font-mono">{String(b.address || b.key || '').slice(0, 10)}…</div>{b.reason && <div className="text-secondary text-xs mt-1">{b.reason}</div>}</div>
                      <button type="button" onClick={async () => { try { await api.post('/api/v1/admin/blacklist', { sessionId, action: 'remove', address: b.address }); show(t('admin.removed_from_blacklist')); refreshBlacklist(); } catch (err: any) { show(errMsg(err)); } }} className="text-xs text-red-400 hover:text-red-300">{t('admin.remove')}</button>
                    </li>
                  ))}</ul>
                )}
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border/20 space-y-4">
              <div><h3 className="text-sm font-black tracking-wide text-white mb-1">{t('admin.grant_title')}</h3><p className="text-xs text-secondary">{t('admin.grant_description')}</p></div>
              <div className="relative">
                <input type="text" value={grantAddress} onChange={(e) => { setGrantAddress(e.target.value); setUserSearch(e.target.value); }} placeholder={t('admin.grant_address_placeholder')} className="w-full rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none" />
                {userResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border/30 bg-card shadow-xl">
                    {userResults.map((u) => (<button key={u.address} type="button" onClick={() => { setGrantAddress(u.address); setUserSearch(''); setUserResults([]); }} className="w-full px-3 py-2 text-left text-xs text-white hover:bg-elevated border-b border-border/10 last:border-0"><span className="font-bold">{u.displayName || u.username || t('admin.unknown')}</span><span className="text-secondary ml-2">{u.address.slice(0, 10)}...{u.address.slice(-6)}</span></button>))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={grantZxc} onChange={(e) => setGrantZxc(e.target.value)} placeholder={t('admin.grant_zxc_placeholder')} className="rounded-lg border border-border/30 bg-elevated px-2 py-2 text-xs text-white focus:border-accent focus:outline-none" />
                <input type="number" value={grantYjc} onChange={(e) => setGrantYjc(e.target.value)} placeholder={t('admin.grant_yjc_placeholder')} className="rounded-lg border border-border/30 bg-elevated px-2 py-2 text-xs text-white focus:border-accent focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select value={grantItemId} onChange={(e) => setGrantItemId(e.target.value)} className="col-span-2 rounded-lg border border-border/30 bg-elevated px-2 py-2 text-xs text-white focus:border-accent focus:outline-none">
                  <option value="">{t('admin.grant_item_select')}</option>{allItemsList.filter((i) => i.type !== 'avatar' && i.type !== 'title').map((item) => (<option key={item.id} value={item.id}>{item.icon || ''} {item.name || item.id} [{item.rarity || ''}]</option>))}
                </select>
                <input type="number" min="1" value={grantItemQty} onChange={(e) => setGrantItemQty(e.target.value)} placeholder={t('admin.quantity')} className="rounded-lg border border-border/30 bg-elevated px-2 py-2 text-xs text-white focus:border-accent focus:outline-none" />
              </div>
              <select value={grantAvatarId} onChange={(e) => setGrantAvatarId(e.target.value)} className="w-full rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none">
                <option value="">{t('admin.grant_avatar_select')}</option>{allAvatars.map((av) => (<option key={av.id} value={av.id}>{av.icon || ''} {av.name || av.id}</option>))}
              </select>
              <select value={grantTitleId} onChange={(e) => setGrantTitleId(e.target.value)} className="w-full rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none">
                <option value="">{t('admin.grant_title_select')}</option>{allTitles.map((t) => (<option key={t.id} value={t.id}>{t.icon || ''} {t.name || t.label || t.id}</option>))}
              </select>
              <input type="text" value={grantNote} onChange={(e) => setGrantNote(e.target.value)} placeholder={t('admin.grant_note_placeholder')} className="w-full rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none" />
              <button type="button" onClick={handleGrantSubmit} className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-xs font-black text-black hover:brightness-110"><Send size={12} /> {t('admin.grant_submit')}</button>
            </div>
          </section>
        )}

        {activeTab === 'blacklist' && (
          <section className="bg-card rounded-2xl p-6 border border-border/20">
            <div className="flex items-center gap-2 mb-4">
              <Ban size={18} className="text-accent" />
              <h3 className="text-sm font-black tracking-wide text-white">{t('admin.blacklist')}</h3>
            </div>
            <form onSubmit={handleBlacklist} className="space-y-3">
              <input
                type="text"
                value={blacklistAddress}
                onChange={(e) => setBlacklistAddress(e.target.value)}
                className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm"
                placeholder={t('admin.blacklist_address_placeholder')}
              />
              <input
                type="text"
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm"
                placeholder={t('admin.blacklist_reason_placeholder')}
                maxLength={200}
              />
              <button type="submit" className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-black tracking-wide">
                {t('admin.add_to_blacklist')}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-border/30">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black tracking-wide text-white">{t('admin.current_blacklist', { count: blacklist.length })}</h4>
                <button
                  type="button"
                  onClick={refreshBlacklist}
                  className="text-xs text-accent hover:underline"
                >
                  {t('admin.refresh')}
                </button>
              </div>
              {blacklist.length === 0 ? (
                <p className="text-xs text-secondary">{t('admin.no_blacklist_records')}</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {blacklist.map((b: any, i: number) => (
                    <li
                      key={b.address || b.key || i}
                      className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-xs"
                    >
                      <div>
                        <div className="text-white font-mono">
                          {String(b.address || b.key || '').slice(0, 10)}…
                        </div>
                        {b.reason && <div className="text-secondary text-xs mt-1">{b.reason}</div>}
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
                            show(t('admin.removed_from_blacklist'));
                            refreshBlacklist();
                          } catch (err: any) {
                            show(errMsg(err));
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        {t('admin.remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="bg-card rounded-2xl p-6 border border-border/20 space-y-4">
            <h3 className="text-sm font-black tracking-wide text-white">{t('admin.user_query')}</h3>
            <p className="text-xs text-secondary">
              {t('admin.user_query_desc')}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={userQueryAddress}
                onChange={(e) => setUserQueryAddress(e.target.value)}
                placeholder={t('admin.user_query_placeholder')}
                className="flex-1 rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={handleUserInspect}
                className="rounded-lg bg-accent px-4 text-xs font-black text-black hover:brightness-110"
              >
                {t('admin.query')}
              </button>
            </div>
            {userInspectErr && <p className="text-xs text-red-400">{userInspectErr}</p>}
            {userInspect && (
              <div className="space-y-3 rounded-lg border border-border/20 bg-elevated p-4">
                <div className="text-xs text-secondary">
                  <span className="text-muted">{t('admin.address')}：</span>
                  <span className="font-mono text-white break-all">{userInspect.user.address}</span>
                </div>
                {userInspect.user.displayName && (
                  <div className="text-xs text-secondary">
                    <span className="text-muted">{t('admin.display_name')}：</span>
                    <span className="text-white">{userInspect.user.displayName}</span>
                  </div>
                )}
                {userInspect.balances && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-card p-3">
                    <div>
                      <p className="text-xs text-muted">{t('admin.zxc_balance')}</p>
                      <p className="mt-1 font-mono text-xs text-white">{nf(Number(userInspect.balances.zxc) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">{t('admin.yjc_balance')}</p>
                      <p className="mt-1 font-mono text-xs text-white">{nf(Number(userInspect.balances.yjc) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">{t('admin.total_bet')}</p>
                      <p className="mt-1 font-mono text-xs text-white">{nf(Number(userInspect.balances.totalBet) || 0)}</p>
                    </div>
                  </div>
                )}
                <div className="text-xs text-secondary">
                  <span className="text-muted">{t('admin.current_win_bias')}</span>
                  <span className="text-accent font-black">
                    {userInspect.profile?.winBias != null ? userInspect.profile.winBias : t('admin.win_bias_not_set')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userBiasInput}
                    onChange={(e) => setUserBiasInput(e.target.value)}
                    placeholder={t('admin.win_bias_placeholder')}
                    className="flex-1 rounded-lg border border-border/30 bg-card px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSetWinBias}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 text-xs font-black text-black hover:brightness-110"
                  >
                    <Sliders size={12} /> {t('admin.apply')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearWinBias}
                    className="rounded-lg border border-border/40 bg-card px-3 text-xs font-black text-secondary hover:border-red-400/60 hover:text-red-300"
                  >
                    {t('admin.clear')}
                  </button>
                </div>

                <div className="space-y-2 border-t border-border/20 pt-3">
                  <p className="text-xs text-secondary">
                    {t('admin.vip_level')}
                    <span className="ml-1 font-black text-accent">
                      {typeof userInspect.vipLevel === 'number' ? userInspect.vipLevel : 0}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {[0, 1, 2, 3, 4, 5].map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => handleSetVipLevel(lv)}
                        className="rounded-lg border border-border/30 bg-card px-3 py-1.5 text-xs font-black text-white hover:border-accent/60 hover:text-accent"
                      >
                        VIP {lv}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border/20 pt-3">
                  <button
                    type="button"
                    onClick={handleResetTotalBet}
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-300 hover:bg-red-500/20"
                  >
                    {t('admin.reset_total_bet_btn')}
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
            <div className="bg-card rounded-2xl p-6 border border-border/20">
              <div className="flex items-center gap-2 mb-4">
                <Package size={18} className="text-accent" />
                <h3 className="text-sm font-black tracking-wide text-white">{t('admin.catalog_save_new')}</h3>
              </div>
              <p className="text-xs text-secondary mb-3">
                {t('admin.catalog_description')}
              </p>
              <form onSubmit={handleCatalogCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={catalogItemId}
                    onChange={(e) => setCatalogItemId(e.target.value)}
                    className="bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm"
                    placeholder={t('admin.item_id_auto')}
                  />
                  <select
                    value={catalogType}
                    onChange={(e) => setCatalogType(e.target.value as any)}
                    className="bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="avatar">{t('admin.type_avatar')}</option>
                    <option value="title">{t('admin.type_title')}</option>
                    <option value="buff">{t('admin.type_buff')}</option>
                    <option value="chest">{t('admin.type_chest')}</option>
                    <option value="key">{t('admin.type_key')}</option>
                    <option value="collectible">{t('admin.type_collectible')}</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={catalogName}
                  onChange={(e) => setCatalogName(e.target.value)}
                  className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm"
                  placeholder={t('admin.item_name_placeholder')}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={catalogRarity}
                    onChange={(e) => setCatalogRarity(e.target.value as any)}
                    className="bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm"
                  >
                    {['common', 'rare', 'epic', 'legendary', 'mythic', 'vip'].map((key) => (
                      <option key={key} value={key}>
                        {t(`admin.rarity_${key}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={catalogIcon}
                    onChange={(e) => setCatalogIcon(e.target.value)}
                    className="bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm"
                    placeholder={t('admin.item_icon_placeholder')}
                  />
                </div>
                <textarea
                  value={catalogDescription}
                  onChange={(e) => setCatalogDescription(e.target.value)}
                  className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm min-h-16"
                  placeholder={t('admin.item_desc_placeholder')}
                  maxLength={500}
                />
                <button type="submit" className="w-full py-2 bg-accent text-[#0e0e0e] rounded-lg text-xs font-black tracking-wide">
                  {t('admin.save_item')}
                </button>
              </form>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border/20">
              <h3 className="text-sm font-black tracking-wide text-white mb-4">
                {t('admin.custom_items_count', { count: avatarsAndTitles.length })}
              </h3>
              {avatarsAndTitles.length === 0 ? (
                <p className="text-xs text-secondary">{t('admin.no_custom_items')}</p>
              ) : (
                <ul className="space-y-2">
                  {avatarsAndTitles.map((item) => (
                    <li key={item.itemId} className="rounded-lg border border-border/30 bg-surface p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.icon || (item.type === 'avatar' ? '👤' : '🏷️')}</span>
                            <p className={`text-sm font-bold ${item.isActive ? 'text-white' : 'text-muted line-through'}`}>
                              {item.name}
                            </p>
                            <span className="text-xs font-black tracking-widest uppercase text-accent">
                              {t(`admin.type_${item.type}`) || item.type} · {t(`admin.rarity_${item.rarity}`) || item.rarity}
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-1">id: {item.itemId}</p>
                          {item.description && (
                            <p className="text-xs text-secondary mt-1 line-clamp-2">{item.description}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => handleCatalogToggle(item)}
                            className="p-1.5 rounded border border-border/30 hover:bg-card"
                            title={item.isActive ? t('admin.hide') : t('admin.show')}
                          >
                            {item.isActive ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-secondary" />}
                          </button>
                          <button
                            onClick={() => handleCatalogDelete(item)}
                            className="p-1.5 rounded border border-red-500/30 hover:bg-red-500/10"
                            title={t('admin.delete')}
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
          <section className="bg-card rounded-2xl p-6 border border-border/20">
            <h3 className="text-sm font-black tracking-wide text-white mb-4">{t('admin.submission_count', { count: submissions.length })}</h3>
            {submissions.length === 0 ? (
              <p className="text-xs text-secondary">{t('admin.no_submissions')}</p>
            ) : (
              <ul className="space-y-3">
                {submissions.map((sub) => (
                  <li
                    key={sub.submissionId}
                    className="rounded-lg border border-border/20 bg-elevated p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-2xl">
                          {sub.icon || (sub.type === 'avatar' ? '👤' : '🏷')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-white">{sub.name}</span>
                            <span className="text-xs font-bold uppercase text-accent">
                              {sub.type === 'avatar' ? t('admin.submission_type_avatar') : t('admin.submission_type_title')}
                            </span>
                            <span className={`text-xs font-bold uppercase ${
                              sub.status === 'pending'
                                ? 'text-accent'
                                : sub.status === 'approved'
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}>
                              {sub.status === 'pending' ? t('admin.status_pending') : sub.status === 'approved' ? t('admin.status_approved') : t('admin.status_rejected')}
                            </span>
                            <span className="text-xs font-bold uppercase text-secondary">
                              {t(`admin.rarity_${sub.rarity}`) || sub.rarity}
                            </span>
                          </div>
                          {sub.description && (
                            <p className="mt-1 text-xs text-secondary break-words">{sub.description}</p>
                          )}
                          <p className="mt-1 text-xs text-muted break-all">
                            {t('admin.submitted_by', { address: `${sub.address?.slice(0, 10)}...${sub.address?.slice(-6)}` })}
                          </p>
                          {sub.reviewNote && (
                            <p className="mt-1 text-xs text-secondary">{t('admin.review_note', { note: sub.reviewNote })}</p>
                          )}
                        </div>
                      </div>
                      {sub.status === 'pending' && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => handleSubmissionApprove(sub)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20"
                            title={t('admin.approved')}
                          >
                            <Check size={14} className="text-emerald-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmissionReject(sub)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20"
                            title={t('admin.rejected')}
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
          <section className="bg-card rounded-2xl p-6 border border-border/20 space-y-6">
            <div>
              <h3 className="text-sm font-black tracking-wide text-white mb-1">{t('admin.campaign_management')}</h3>
              <p className="text-xs text-secondary">
                {t('admin.campaign_management_desc')}
              </p>
            </div>

            <div className="rounded-lg border border-border/20 bg-elevated p-4 space-y-3">
              <div className="text-xs font-black text-accent">{t('admin.add_edit_campaign')}</div>
              <input
                type="text"
                value={campaignDraftId}
                onChange={(e) => setCampaignDraftId(e.target.value)}
                placeholder={t('admin.campaign_id_placeholder')}
                className="w-full rounded-lg border border-border/30 bg-card px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder={t('admin.campaign_title_placeholder')}
                className="w-full rounded-lg border border-border/30 bg-card px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
              <textarea
                value={campaignDescription}
                onChange={(e) => setCampaignDescription(e.target.value)}
                placeholder={t('admin.campaign_desc_placeholder')}
                rows={4}
                className="w-full rounded-lg border border-border/30 bg-card px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={campaignStartAt}
                  onChange={(e) => setCampaignStartAt(e.target.value)}
                  className="rounded-lg border border-border/30 bg-card px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
                />
                <input
                  type="datetime-local"
                  value={campaignEndAt}
                  onChange={(e) => setCampaignEndAt(e.target.value)}
                  className="rounded-lg border border-border/30 bg-card px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="1"
                  value={campaignClaimLimit}
                  onChange={(e) => setCampaignClaimLimit(e.target.value)}
                  placeholder={t('admin.claims_per_user')}
                  className="rounded-lg border border-border/30 bg-card px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
                />
                <input
                  type="number"
                  value={campaignRewardZxc}
                  onChange={(e) => setCampaignRewardZxc(e.target.value)}
                  placeholder={t('admin.reward_zxc')}
                  className="rounded-lg border border-border/30 bg-card px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
                />
                <input
                  type="number"
                  value={campaignRewardYjc}
                  onChange={(e) => setCampaignRewardYjc(e.target.value)}
                  placeholder={t('admin.reward_yjc')}
                  className="rounded-lg border border-border/30 bg-card px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={campaignRewardItemId}
                  onChange={(e) => setCampaignRewardItemId(e.target.value)}
                  className="rounded-lg border border-border/30 bg-card px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
                >
                  <option value="">{t('admin.reward_item_select')}</option>
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
                  placeholder={t('admin.reward_qty')}
                  className="rounded-lg border border-border/30 bg-card px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
                />
              </div>
              <select
                value={campaignRewardAvatarId}
                onChange={(e) => setCampaignRewardAvatarId(e.target.value)}
                className="w-full rounded-lg border border-border/30 bg-card px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
              >
                <option value="">{t('admin.reward_avatar_select')}</option>
                {allAvatars.map((av) => (
                  <option key={av.id} value={av.id}>
                    {av.icon || ''} {av.name || av.id}
                  </option>
                ))}
              </select>
              <select
                value={campaignRewardTitleId}
                onChange={(e) => setCampaignRewardTitleId(e.target.value)}
                className="w-full rounded-lg border border-border/30 bg-card px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
              >
                <option value="">{t('admin.reward_title_select')}</option>
                {allTitles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon || ''} {t.name || t.id}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-secondary">
                <input
                  type="checkbox"
                  checked={campaignIsActive}
                  onChange={(e) => setCampaignIsActive(e.target.checked)}
                />
                {t('admin.activate_on_create')}
              </label>
              <button
                type="button"
                onClick={handleCampaignSave}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-black text-black hover:brightness-110"
              >
                <CalendarClock size={12} /> {t('admin.save_campaign')}
              </button>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-black text-white">{t('admin.current_campaigns', { count: campaigns.length })}</h4>
              {campaigns.length === 0 ? (
                <p className="text-xs text-secondary">{t('admin.no_campaigns')}</p>
              ) : (
                <ul className="space-y-2">
                  {campaigns.map((c) => (
                    <li
                      key={c.campaignId}
                      className="rounded-lg border border-border/20 bg-elevated p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-white">{c.title}</span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                c.isActive
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-[#494847]/30 text-secondary'
                              }`}
                            >
                              {c.isActive ? t('admin.campaign_active') : t('admin.campaign_inactive')}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-secondary break-words">
                            ID: {c.campaignId}
                          </p>
                          {c.description && (
                            <p className="mt-1 text-xs text-secondary break-words">
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
                            className="rounded-lg bg-card p-2 hover:bg-accent/10"
                            title={t('admin.edit_announcement')}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCampaignToggle(c)}
                            className="rounded-lg bg-card p-2 hover:bg-accent/10"
                            title={c.isActive ? t('admin.hide') : t('admin.show')}
                          >
                            {c.isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCampaignDelete(c.campaignId)}
                            className="rounded-lg bg-card p-2 hover:bg-red-500/10"
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
          <section className="bg-card rounded-2xl p-6 border border-border/20 space-y-4">
            <div>
              <h3 className="text-sm font-black tracking-wide text-white mb-1">{t('admin.grant_title')}</h3>
              <p className="text-xs text-secondary">
                {t('admin.grant_description')}
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
                placeholder={t('admin.grant_address_placeholder')}
                className="w-full rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
              {showUserDropdown && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border/30 bg-card shadow-xl">
                  {userResults.map((u) => (
                    <button
                      key={u.address}
                      type="button"
                      onClick={() => {
                        setGrantAddress(u.address);
                        setUserSearch('');
                        setUserResults([]);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-white hover:bg-elevated border-b border-border/10 last:border-0"
                    >
                      <span className="font-bold">{u.displayName || u.username || t('admin.unknown')}</span>
                      <span className="text-secondary ml-2">{u.address.slice(0, 10)}...{u.address.slice(-6)}</span>
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
                placeholder={t('admin.grant_zxc_placeholder')}
                className="rounded-lg border border-border/30 bg-elevated px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
              <input
                type="number"
                value={grantYjc}
                onChange={(e) => setGrantYjc(e.target.value)}
                placeholder={t('admin.grant_yjc_placeholder')}
                className="rounded-lg border border-border/30 bg-elevated px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={grantItemId}
                onChange={(e) => setGrantItemId(e.target.value)}
                className="col-span-2 rounded-lg border border-border/30 bg-elevated px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
              >
                <option value="">{t('admin.grant_item_select')}</option>
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
                placeholder={t('admin.quantity')}
                className="rounded-lg border border-border/30 bg-elevated px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
            </div>
            <select
              value={grantAvatarId}
              onChange={(e) => setGrantAvatarId(e.target.value)}
              className="w-full rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
            >
              <option value="">{t('admin.grant_avatar_select')}</option>
              {allAvatars.map((av) => (
                <option key={av.id} value={av.id}>
                  {av.icon || ''} {av.name || av.id}
                </option>
              ))}
            </select>
            <select
              value={grantTitleId}
              onChange={(e) => setGrantTitleId(e.target.value)}
              className="w-full rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
            >
              <option value="">{t('admin.grant_title_select')}</option>
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
              placeholder={t('admin.grant_note_placeholder')}
              className="w-full rounded-lg border border-border/30 bg-elevated px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGrantSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-xs font-black text-black hover:brightness-110"
            >
              <Send size={12} /> {t('admin.grant_submit')}
            </button>
          </section>
        )}

        {activeTab === 'tickets' && (
          <section className="bg-card rounded-2xl p-6 border border-border/20 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-accent" />
              <h3 className="text-sm font-black tracking-wide text-white">{t('admin.ticket_title', { count: tickets.length })}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
                className="bg-surface border border-border/30 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">{t('admin.all_statuses')}</option>
                <option value="open">{t('admin.status_open')}</option>
                <option value="in_progress">{t('admin.status_in_progress')}</option>
                <option value="resolved">{t('admin.status_resolved')}</option>
                <option value="closed">{t('admin.status_closed')}</option>
              </select>
              <input
                type="text"
                value={ticketKeyword}
                onChange={(e) => setTicketKeyword(e.target.value)}
                placeholder={t('admin.keyword_search')}
                className="flex-1 min-w-[160px] bg-surface border border-border/30 rounded-lg px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={refreshTickets}
                className="rounded-lg bg-accent px-4 text-xs font-black text-black hover:brightness-110"
              >
                {t('admin.query')}
              </button>
            </div>
            {tickets.length === 0 ? (
              <p className="text-xs text-secondary">{t('admin.no_tickets')}</p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
                {tickets.map((t: any) => (
                  <li key={t.reportId} className="rounded-lg border border-border/30 bg-surface p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-black text-white">{t.title || t('admin.no_title')}</p>
                        <p className="text-xs text-secondary">
                          {t.category || t('admin.other')} · {t.address ? `${String(t.address).slice(0, 10)}…` : t('admin.anonymous')}
                          {t.createdAt && ` · ${new Date(t.createdAt).toLocaleString()}`}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-black uppercase tracking-wide px-2 py-1 rounded ${
                          t.status === 'open'
                            ? 'bg-red-500/20 text-red-300'
                            : t.status === 'in_progress'
                            ? 'bg-accent/20 text-accent'
                            : t.status === 'resolved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-[#494847]/20 text-secondary'
                        }`}
                      >
                        {t.status === 'open'
                          ? t('admin.status_open')
                          : t.status === 'in_progress'
                          ? t('admin.status_in_progress')
                          : t.status === 'resolved'
                          ? t('admin.status_resolved')
                          : t.status === 'closed'
                          ? t('admin.status_closed')
                          : t.status}
                      </span>
                    </div>
                    {t.message && <p className="text-xs text-white whitespace-pre-wrap break-words">{t.message}</p>}
                    {t.adminUpdate && (
                      <div className="rounded bg-accent/10 border border-accent/30 p-2">
                        <p className="text-xs font-black text-accent mb-1">{t('admin.admin_reply')}</p>
                        <p className="text-xs text-white whitespace-pre-wrap break-words">{t.adminUpdate}</p>
                      </div>
                    )}
                    <textarea
                      value={ticketReplyDraft[t.reportId] ?? ''}
                      onChange={(e) => setTicketReplyDraft((prev) => ({ ...prev, [t.reportId]: e.target.value }))}
                      placeholder={t('admin.reply_placeholder')}
                      className="w-full bg-card border border-border/30 rounded-lg px-3 py-2 text-xs text-white resize-y"
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
                              show(t('admin.ticket_updated'));
                              setTicketReplyDraft((prev) => ({ ...prev, [t.reportId]: '' }));
                              refreshTickets();
                            } catch (err: any) {
                              show(errMsg(err));
                            }
                          }}
                          className={`text-xs font-black px-2 py-1 rounded border ${
                            t.status === s
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border/40 text-secondary hover:border-accent/60 hover:text-accent'
                          }`}
                        >
                          {s === 'open' ? t('admin.status_open') : s === 'in_progress' ? t('admin.status_in_progress') : s === 'resolved' ? t('admin.status_resolved') : t('admin.status_closed')}
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
  const { t } = useTranslation();
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
      alert(err?.response?.data?.message || t('admin.operation_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-card p-4 rounded-xl border border-border/30 space-y-3">
        <h3 className="text-sm font-black text-accent">{editing ? t('admin.edit_announcement') : t('admin.new_announcement_title')}</h3>
        <input
          value={form.title}
          onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
          placeholder={t('admin.announcement_title_placeholder')}
          className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm text-white"
          required
        />
        <textarea
          value={form.content}
          onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
          placeholder={t('admin.announcement_content_placeholder')}
          className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm text-white min-h-[100px]"
          required
        />
        <div className="flex gap-4">
          <select
            value={form.type}
            onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
            className="bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="info">{t('admin.type_normal')}</option>
            <option value="warning">{t('admin.type_maintenance')}</option>
            <option value="urgent">{t('admin.type_urgent')}</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
            />
            {t('admin.enabled')}
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="flex-1 bg-accent text-black font-black py-2 rounded-lg">
            {loading ? t('admin.processing') : t('admin.save_announcement')}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => { setEditing(null); setForm({ title: '', content: '', type: 'info', active: true }); }}
              className="px-4 border border-border/30 text-secondary rounded-lg"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {anns.map(ann => (
          <div key={ann.id} className="bg-card p-3 rounded-xl border border-border/20 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-white">{ann.title}</p>
              <p className="text-xs text-secondary">{ann.type} · {ann.active ? t('admin.enabled') : t('admin.disabled')}</p>
            </div>
            <button
              onClick={() => {
                setEditing(ann);
                setForm({ title: ann.title, content: ann.content, type: ann.type, active: ann.active });
              }}
              className="text-accent text-xs font-bold border border-accent/30 px-2 py-1 rounded"
            >
              {t('admin.edit_announcement')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
