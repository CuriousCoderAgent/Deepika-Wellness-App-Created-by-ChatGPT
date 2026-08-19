import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadMember, login, logout, restoreToken, saveMember } from "./src/api";
import type { DailyAction, EffortLevel, MemberDoc, PulseEntry } from "./src/types";

const C = {
  paper: "#F7F2E8",
  card: "#FFFDF8",
  ink: "#292925",
  soft: "#68665E",
  faint: "#99958A",
  line: "#E5DED0",
  green: "#39755E",
  greenTint: "#DDECE3",
  marigold: "#D99A2B",
  marigoldTint: "#F8EBCF",
  calm: "#516C86",
};

type Tab = "today" | "journey" | "progress" | "coach" | "profile";
const tabs: { key: Tab; label: string; glyph: string }[] = [
  { key: "today", label: "Today", glyph: "●" },
  { key: "journey", label: "Journey", glyph: "◇" },
  { key: "progress", label: "Progress", glyph: "↗" },
  { key: "coach", label: "Deepika", glyph: "♡" },
  { key: "profile", label: "You", glyph: "○" },
];

function Login({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!username.trim() || !password) return setError("Enter your username and password.");
    setBusy(true);
    setError("");
    try {
      onSuccess(await login(username.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.loginPage} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.brandMark}><Text style={s.brandLetter}>D</Text></View>
      <Text style={s.brand}>Deepika Wellness</Text>
      <Text style={s.loginTitle}>Welcome back.</Text>
      <Text style={s.loginCopy}>Your plan, your progress, and Deepika’s guidance—together in one private place.</Text>
      <View style={s.form}>
        <Text style={s.inputLabel}>Username</Text>
        <TextInput style={s.input} autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
        <Text style={s.inputLabel}>Password</Text>
        <TextInput style={s.input} secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        {!!error && <Text style={s.error}>{error}</Text>}
        <Pressable style={({ pressed }) => [s.primaryButton, pressed && s.pressed]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryButtonText}>Sign in</Text>}
        </Pressable>
      </View>
      <Text style={s.privacyNote}>Your wellness information is only visible to you and your coach.</Text>
    </KeyboardAvoidingView>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

function Pulse({ doc, onChange }: { doc: MemberDoc; onChange: (doc: MemberDoc) => void }) {
  const moods = [
    { label: "Good", glyph: "◡", energy: 4, stress: 4 },
    { label: "Okay", glyph: "—", energy: 3, stress: 3 },
    { label: "Tired", glyph: "☾", energy: 2, stress: 3 },
    { label: "Stressed", glyph: "⌁", energy: 2, stress: 2 },
  ];
  const current = doc.pulses.find((p) => p.dayOffset === 0);

  const choose = (mood: (typeof moods)[number]) => {
    const pulse: PulseEntry = {
      id: current?.id ?? `pulse-${Date.now()}`,
      memberId: doc.member.id,
      dayOffset: 0,
      energy: mood.energy,
      sleep: current?.sleep ?? 0,
      stress: mood.stress,
      partial: !current?.sleep,
      symptoms: current?.symptoms ?? [],
      note: current?.note,
      provenance: { source: "member_manual", enteredBy: doc.member.name, at: new Date().toISOString() },
    };
    onChange({ ...doc, pulses: [...doc.pulses.filter((p) => p.dayOffset !== 0), pulse] });
  };

  return (
    <Card>
      <View style={s.rowBetween}><Text style={s.cardTitle}>How are you feeling?</Text>{current && <Text style={s.saved}>✓ Saved</Text>}</View>
      <View style={s.moodRow}>
        {moods.map((mood) => {
          const active = current?.energy === mood.energy && current?.stress === mood.stress;
          return (
            <Pressable key={mood.label} style={s.mood} onPress={() => choose(mood)}>
              <View style={[s.moodCircle, active && s.moodCircleActive]}><Text style={[s.moodGlyph, active && s.moodGlyphActive]}>{mood.glyph}</Text></View>
              <Text style={[s.moodLabel, active && s.moodLabelActive]}>{mood.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {current && <Text style={s.pulseSummary}>Energy {current.energy}/5 · Calm {current.stress}/5 · Sleep {current.sleep ? `${current.sleep}/5` : "not added"}</Text>}
    </Card>
  );
}

function ActionCard({ action, onComplete }: { action: DailyAction; onComplete: (level: EffortLevel | "rest") => void }) {
  return (
    <Card style={s.actionCard}>
      <View style={s.actionTop}>
        <View style={s.actionText}><Text style={s.actionTitle}>{action.title}</Text><Text style={s.actionWhy}>{action.why}</Text></View>
        <Text style={[s.actionStatus, action.completed && s.actionStatusDone]}>{action.completed ? "✓" : "○"}</Text>
      </View>
      <View style={s.effortRow}>
        {(["minimum", "target", "stretch"] as EffortLevel[]).map((level) => (
          <Pressable key={level} style={[s.effort, action.completed === level && s.effortActive]} onPress={() => onComplete(level)}>
            <Text style={[s.effortLabel, action.completed === level && s.effortLabelActive]}>{level.charAt(0).toUpperCase() + level.slice(1)}</Text>
            <Text style={[s.effortDetail, action.completed === level && s.effortLabelActive]}>{action[level].minutes ? `${action[level].minutes} min` : action[level].label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => onComplete("rest")}><Text style={s.notToday}>Not today</Text></Pressable>
    </Card>
  );
}

function Today({ doc, update }: { doc: MemberDoc; update: (doc: MemberDoc) => void }) {
  const first = doc.member.name.split(" ")[0];
  const actions = doc.actions.filter((a) => a.dayOffset === 0);
  const complete = (id: string, level: EffortLevel | "rest") => {
    update({ ...doc, actions: doc.actions.map((a) => a.id === id ? { ...a, completed: level } : a) });
  };
  return (
    <>
      <Text style={s.eyebrow}>WEEK {doc.member.week} · {doc.member.phase.toUpperCase()}</Text>
      <Text style={s.hero}>Hello, {first}.</Text>
      <Text style={s.heroCopy}>One thing done today keeps the week intact.</Text>
      {doc.member.lastPlanChange && <View style={s.planChange}><Text style={s.planLabel}>↻ Plan adjusted</Text><Text style={s.planCopy}>{doc.member.lastPlanChange.rationale}</Text></View>}
      <Pulse doc={doc} onChange={update} />
      <View style={s.sectionHead}><Text style={s.sectionTitle}>Your focus today</Text><Text style={s.sectionMeta}>{actions.filter((a) => a.completed && a.completed !== "rest").length} of {actions.length}</Text></View>
      {actions.length ? actions.map((a) => <ActionCard key={a.id} action={a} onComplete={(level) => complete(a.id, level)} />) : <Card><Text style={s.empty}>Nothing scheduled today. That is intentional.</Text></Card>}
    </>
  );
}

function Journey({ doc }: { doc: MemberDoc }) {
  return <><Text style={s.eyebrow}>YOUR 12-WEEK JOURNEY</Text><Text style={s.hero}>Week {doc.member.week}</Text><Text style={s.heroCopy}>{doc.member.phase}—build the week around what is possible now.</Text><Card><Text style={s.cardTitle}>This week’s focus</Text>{doc.member.weeklyFocus.map((x) => <View key={x} style={s.listRow}><Text style={s.bullet}>✓</Text><Text style={s.listText}>{x}</Text></View>)}</Card><Text style={s.sectionTitle}>What you are working toward</Text>{doc.member.goals.map((x) => <Card key={x} style={s.compactCard}><Text style={s.listText}>{x}</Text></Card>)}</>;
}

function Progress({ doc }: { doc: MemberDoc }) {
  const days = Array.from({ length: 14 }, (_, i) => i - 13);
  const active = days.filter((d) => doc.actions.some((a) => a.dayOffset === d && a.completed && a.completed !== "rest")).length;
  const recent = [...doc.pulses].filter((p) => p.dayOffset >= -13).sort((a, b) => a.dayOffset - b.dayOffset);
  return <><Text style={s.eyebrow}>YOUR PROGRESS</Text><Text style={s.hero}>{active} of 14 days</Text><Text style={s.heroCopy}>included at least one healthy action. This is consistency—not a streak you can lose.</Text><Card><Text style={s.cardTitle}>The shape of your fortnight</Text><View style={s.dotRow}>{days.map((d) => { const done = doc.actions.some((a) => a.dayOffset === d && a.completed && a.completed !== "rest"); return <View key={d} style={[s.dayDot, done && s.dayDotDone]} />; })}</View></Card><Card><Text style={s.cardTitle}>Energy check-ins</Text>{recent.length ? recent.slice(-7).map((p) => <View key={p.id} style={s.metricRow}><Text style={s.metricDay}>{p.dayOffset === 0 ? "Today" : `${Math.abs(p.dayOffset)}d ago`}</Text><View style={s.metricTrack}><View style={[s.metricFill, { width: `${p.energy * 20}%` }]} /></View><Text style={s.metricValue}>{p.energy}/5</Text></View>) : <Text style={s.empty}>Your check-ins will appear here.</Text>}</Card></>;
}

function Coach({ doc }: { doc: MemberDoc }) {
  const messages = [...doc.messages].sort((a, b) => b.dayOffset - a.dayOffset);
  const next = [...doc.sessions].filter((x) => x.status === "scheduled" && x.dayOffset >= 0).sort((a, b) => a.dayOffset - b.dayOffset)[0];
  return <><Text style={s.eyebrow}>YOUR COACH</Text><Text style={s.hero}>Deepika is here.</Text><Text style={s.heroCopy}>Questions, plan changes, and the human context behind your week.</Text>{next && <View style={s.session}><Text style={s.sessionLabel}>NEXT SESSION</Text><Text style={s.sessionTitle}>{next.type}</Text><Text style={s.sessionMeta}>{next.dayOffset === 0 ? "Today" : `In ${next.dayOffset} day${next.dayOffset === 1 ? "" : "s"}`} · {next.time}</Text></View>}<Text style={s.sectionTitle}>Messages</Text>{messages.length ? messages.slice(0, 8).map((m) => <Card key={m.id} style={m.from === "coach" ? s.coachMessage : undefined}><View style={s.rowBetween}><Text style={[s.messageFrom, m.from === "coach" && s.messageFromCoach]}>{m.from === "coach" ? "Deepika" : "You"}</Text><Text style={s.messageTime}>{m.time}</Text></View><Text style={s.messageBody}>{m.body}</Text></Card>) : <Card><Text style={s.empty}>No messages yet.</Text></Card>}</>;
}

function Profile({ doc, onLogout }: { doc: MemberDoc; onLogout: () => void }) {
  const website = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  return <><View style={s.profileBadge}><Text style={s.profileInitials}>{doc.member.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</Text></View><Text style={[s.hero, s.center]}>{doc.member.name}</Text><Text style={[s.heroCopy, s.center]}>Week {doc.member.week} · {doc.member.phase}</Text><Card><Text style={s.cardTitle}>Your boundaries matter</Text><Text style={s.profileCopy}>{doc.member.constraints.length ? doc.member.constraints.join(" · ") : "Add your preferences with Deepika."}</Text></Card><Card><Text style={s.cardTitle}>Privacy and support</Text><Text style={s.profileCopy}>Your information is used for your coaching journey. You can request an export or deletion at any time.</Text>{website ? <View style={s.policyLinks}><Pressable accessibilityRole="link" onPress={() => Linking.openURL(`${website}/privacy`)}><Text style={s.policyLink}>Privacy policy</Text></Pressable><Pressable accessibilityRole="link" onPress={() => Linking.openURL(`${website}/account-deletion`)}><Text style={s.policyLink}>Delete account</Text></Pressable></View> : null}</Card><Pressable accessibilityRole="button" style={s.secondaryButton} onPress={onLogout}><Text style={s.secondaryButtonText}>Sign out</Text></Pressable><Text style={s.disclaimer}>Deepika Wellness supports coaching and education. It does not diagnose conditions or replace medical care.</Text></>;
}

function MemberApp({ token, onSignedOut }: { token: string; onSignedOut: () => void }) {
  const [doc, setDoc] = useState<MemberDoc | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try { setDoc(await loadMember(token)); }
    catch (err) { Alert.alert("Couldn’t load your plan", err instanceof Error ? err.message : "Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { refresh(); }, [token]);

  const update = async (next: MemberDoc) => {
    const previous = doc;
    setDoc(next);
    setSaving(true);
    try { await saveMember(token, next); }
    catch (err) { setDoc(previous); Alert.alert("Not saved", err instanceof Error ? err.message : "Please try again."); }
    finally { setSaving(false); }
  };

  const content = useMemo(() => {
    if (!doc) return null;
    if (tab === "today") return <Today doc={doc} update={update} />;
    if (tab === "journey") return <Journey doc={doc} />;
    if (tab === "progress") return <Progress doc={doc} />;
    if (tab === "coach") return <Coach doc={doc} />;
    return <Profile doc={doc} onLogout={async () => { await logout(); onSignedOut(); }} />;
  }, [doc, tab]);

  if (loading) return <View style={s.loading}><ActivityIndicator size="large" color={C.green} /><Text style={s.loadingText}>Loading your plan…</Text></View>;
  if (!doc) return <View style={s.loading}><Text style={s.error}>Your plan could not be loaded.</Text><Pressable style={s.primaryButton} onPress={refresh}><Text style={s.primaryButtonText}>Try again</Text></Pressable></View>;

  return <SafeAreaView style={s.app}><StatusBar style="dark" /><View style={s.topBar}><Text style={s.topBrand}>Deepika Wellness</Text>{saving && <Text style={s.saving}>Saving…</Text>}</View><ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.green} onRefresh={() => { setRefreshing(true); refresh(); }} />}>{content}<View style={{ height: 30 }} /></ScrollView><View style={s.tabBar}>{tabs.map((item) => <Pressable key={item.key} style={s.tab} onPress={() => setTab(item.key)}><Text style={[s.tabGlyph, tab === item.key && s.tabActive]}>{item.glyph}</Text><Text style={[s.tabLabel, tab === item.key && s.tabActive]}>{item.label}</Text></Pressable>)}</View></SafeAreaView>;
}

export default function App() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { restoreToken().then(setToken); }, []);
  if (token === undefined) return <View style={s.loading}><ActivityIndicator size="large" color={C.green} /></View>;
  return <SafeAreaProvider><StatusBar style="dark" />{token ? <MemberApp token={token} onSignedOut={() => setToken(null)} /> : <Login onSuccess={setToken} />}</SafeAreaProvider>;
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.paper }, scroll: { flex: 1 }, content: { padding: 20, paddingTop: 16 }, loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.paper, padding: 28, gap: 14 }, loadingText: { color: C.soft, fontSize: 15 }, topBar: { height: 50, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, topBrand: { color: C.ink, fontSize: 16, fontWeight: "600" }, saving: { color: C.green, fontSize: 12 },
  loginPage: { flex: 1, backgroundColor: C.paper, padding: 28, justifyContent: "center" }, brandMark: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.marigold, alignItems: "center", justifyContent: "center", marginBottom: 14 }, brandLetter: { color: "white", fontSize: 25, fontWeight: "700" }, brand: { fontSize: 14, color: C.marigold, fontWeight: "700", letterSpacing: 0.7 }, loginTitle: { fontSize: 34, color: C.ink, fontWeight: "700", marginTop: 24 }, loginCopy: { color: C.soft, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 420 }, form: { marginTop: 28 }, inputLabel: { color: C.ink, fontSize: 13, fontWeight: "600", marginBottom: 7, marginTop: 12 }, input: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, color: C.ink, fontSize: 17, minHeight: 52, paddingHorizontal: 16 }, error: { color: "#A34336", fontSize: 13, lineHeight: 19, marginTop: 12 }, privacyNote: { color: C.faint, fontSize: 12, lineHeight: 18, marginTop: 24, textAlign: "center" },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: C.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, marginTop: 20 }, primaryButtonText: { color: "white", fontSize: 16, fontWeight: "700" }, secondaryButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", marginTop: 16 }, secondaryButtonText: { color: C.ink, fontWeight: "600", fontSize: 15 }, pressed: { opacity: 0.85 },
  eyebrow: { color: C.green, fontSize: 11, fontWeight: "700", letterSpacing: 1.1, marginBottom: 8 }, hero: { color: C.ink, fontSize: 30, lineHeight: 36, fontWeight: "700" }, heroCopy: { color: C.soft, fontSize: 15, lineHeight: 22, marginTop: 5, marginBottom: 20 }, card: { backgroundColor: C.card, borderRadius: 20, padding: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, marginBottom: 12 }, compactCard: { paddingVertical: 14 }, cardTitle: { color: C.ink, fontSize: 15, fontWeight: "700" }, rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, saved: { color: C.green, fontSize: 11, fontWeight: "600" }, sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, marginBottom: 10 }, sectionTitle: { color: C.ink, fontSize: 17, fontWeight: "700", marginTop: 16, marginBottom: 10 }, sectionMeta: { color: C.faint, fontSize: 12 }, empty: { color: C.soft, fontSize: 14, lineHeight: 20, textAlign: "center" },
  planChange: { backgroundColor: C.greenTint, borderRadius: 17, padding: 15, marginBottom: 12 }, planLabel: { color: C.green, fontSize: 12, fontWeight: "700" }, planCopy: { color: C.soft, fontSize: 13, lineHeight: 19, marginTop: 5 }, moodRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 }, mood: { alignItems: "center", flex: 1 }, moodCircle: { width: 45, height: 45, borderRadius: 23, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }, moodCircleActive: { backgroundColor: C.greenTint }, moodGlyph: { color: C.faint, fontSize: 21 }, moodGlyphActive: { color: C.green, fontWeight: "700" }, moodLabel: { color: C.faint, fontSize: 11, marginTop: 6 }, moodLabelActive: { color: C.ink, fontWeight: "600" }, pulseSummary: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, color: C.soft, fontSize: 12, marginTop: 14, paddingTop: 12 },
  actionCard: { padding: 16 }, actionTop: { flexDirection: "row", gap: 12 }, actionText: { flex: 1 }, actionTitle: { color: C.ink, fontSize: 16, fontWeight: "700", lineHeight: 21 }, actionWhy: { color: C.soft, fontSize: 13, lineHeight: 19, marginTop: 4 }, actionStatus: { width: 28, height: 28, borderRadius: 14, color: C.faint, borderWidth: 2, borderColor: C.line, textAlign: "center", textAlignVertical: "center", fontSize: 15 }, actionStatusDone: { backgroundColor: C.green, borderColor: C.green, color: "white" }, effortRow: { flexDirection: "row", gap: 7, marginTop: 15 }, effort: { flex: 1, minHeight: 55, borderRadius: 12, backgroundColor: C.paper, padding: 8, justifyContent: "center" }, effortActive: { backgroundColor: C.green }, effortLabel: { color: C.ink, fontSize: 11, fontWeight: "700" }, effortDetail: { color: C.faint, fontSize: 10, marginTop: 2 }, effortLabelActive: { color: "white" }, notToday: { color: C.faint, fontSize: 12, textAlign: "center", paddingTop: 13, paddingBottom: 2 },
  listRow: { flexDirection: "row", gap: 10, marginTop: 13 }, bullet: { color: C.green, fontSize: 15, fontWeight: "700" }, listText: { flex: 1, color: C.ink, fontSize: 15, lineHeight: 21 }, dotRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 }, dayDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.line }, dayDotDone: { backgroundColor: C.green }, metricRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 13 }, metricDay: { color: C.soft, fontSize: 11, width: 48 }, metricTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: C.line, overflow: "hidden" }, metricFill: { height: "100%", backgroundColor: C.green, borderRadius: 4 }, metricValue: { width: 25, color: C.soft, fontSize: 11 },
  session: { backgroundColor: C.marigoldTint, borderRadius: 19, padding: 18, marginBottom: 8 }, sessionLabel: { color: C.marigold, fontSize: 10, fontWeight: "800", letterSpacing: 1 }, sessionTitle: { color: C.ink, fontSize: 18, fontWeight: "700", marginTop: 7 }, sessionMeta: { color: C.soft, fontSize: 13, marginTop: 3 }, coachMessage: { backgroundColor: C.marigoldTint, borderColor: "#EED49E" }, messageFrom: { color: C.green, fontSize: 12, fontWeight: "700" }, messageFromCoach: { color: C.marigold }, messageTime: { color: C.faint, fontSize: 10 }, messageBody: { color: C.ink, fontSize: 14, lineHeight: 21, marginTop: 8 },
  profileBadge: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.greenTint, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 10, marginBottom: 12 }, profileInitials: { color: C.green, fontSize: 24, fontWeight: "700" }, center: { textAlign: "center" }, profileCopy: { color: C.soft, fontSize: 14, lineHeight: 21, marginTop: 9 }, policyLinks: { flexDirection: "row", gap: 22, marginTop: 15 }, policyLink: { color: C.green, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" }, disclaimer: { color: C.faint, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 20 },
  tabBar: { height: 68, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: C.card, flexDirection: "row", paddingTop: 7, paddingBottom: 5 }, tab: { flex: 1, alignItems: "center", justifyContent: "center" }, tabGlyph: { color: C.faint, fontSize: 19, height: 25 }, tabLabel: { color: C.faint, fontSize: 10, fontWeight: "500" }, tabActive: { color: C.green, fontWeight: "700" },
});
