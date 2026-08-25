import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { ChevronRight, Sparkles, UserRound } from "lucide-react-native";
import { DEMO_TOKEN, askCoach } from "../api";
import { COACH_NAME, COACH_OPENERS } from "../coach";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { newId } from "../ids";
import { type MemberDoc, type Message } from "../types";
import { Card, useScrollToTop } from "../ui";

/**
 * The Coach tab.
 *
 * The human coach is a paid extra almost nobody has yet, which left this
 * screen as a message box that nothing answered. Vera answers it — grounded in
 * the member's own plan, and bounded by the rules in `lib/coach-ai.ts`.
 *
 * Two things are load-bearing in how this is presented:
 *
 * **She is never disguised as a person.** Her bubbles are labelled, her
 * avatar is not a photograph, and the first thing the screen says is that she
 * is part of the app. A member who thinks a nurse is reading this will tell it
 * things she should be telling a clinic.
 *
 * **A human coach outranks her.** Where one exists, their messages sit in the
 * same conversation, marked as theirs, and Vera says so when asked to make a
 * decision that is theirs to make.
 *
 * The conversation lives in `doc.messages`, which the phone already owns and
 * syncs. Vera has no route that can write to the derived plan state.
 */
export function Coach({
  doc,
  update,
  token,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
}) {
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  /*
   * How much of the conversation is on screen.
   *
   * The last twenty were rendered and the rest were simply not drawn — they
   * were in the document the whole time, reachable by nothing. A member who
   * asked something useful a month ago could not find it, and neither could
   * the coach reading over her shoulder.
   *
   * Grows on demand rather than paging: these are short messages, she is
   * looking for one thing she half-remembers, and "show me more" is a much
   * easier idea than page numbers.
   */
  const PAGE = 20;
  const [shown, setShown] = useState(PAGE);
  const scrollToTop = useScrollToTop();
  const messages = [...doc.messages].sort((a, b) => a.dayOffset - b.dayOffset);
  const hasHumanCoach = doc.coaching?.mode === "coached";
  const next = [...doc.sessions]
    .filter((x) => x.status === "scheduled" && x.dayOffset >= 0)
    .sort((a, b) => a.dayOffset - b.dayOffset)[0];

  const append = (
    current: MemberDoc,
    from: Message["from"],
    body: string,
    /**
     * The id the server stored this under, when it stored one.
     *
     * Vera's replies are written server-side — see persistExchange in
     * app/api/coach/ask. Storing them under the server's id is what makes
     * them survive: mergeMemberUpdate only accepts *new* client messages from
     * "member", so an id the server has never seen is discarded, which is why
     * her half of the conversation used to vanish on reload.
     */
    id?: string,
  ): MemberDoc => ({
    ...current,
    messages: [
      ...current.messages,
      {
        id: id ?? newId(`message-${from}`),
        memberId: current.member.id,
        from,
        kind: "text",
        body,
        dayOffset: 0,
        time: "just now",
        read: from === "member",
      },
    ],
  });

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || thinking) return;
    setDraft("");
    const withQuestion = append(doc, "member", question);
    update(withQuestion);
    if (token === DEMO_TOKEN) {
      update(
        append(
          withQuestion,
          "ai",
          "This is the sample account, so I am not connected here. Sign in with your own account and I can answer from your plan.",
        ),
      );
      return;
    }
    setThinking(true);
    try {
      // Only the conversation goes back — the server builds her context from
      // the stored document rather than trusting anything the phone sends.
      const history = withQuestion.messages
        .filter((m) => m.from === "member" || m.from === "ai")
        .slice(-12)
        .map((m) => ({
          role: (m.from === "member" ? "user" : "assistant") as
            | "user"
            | "assistant",
          content: m.body,
        }));
      const result = await askCoach(token, question, history.slice(0, -1));
      update(append(withQuestion, "ai", result.reply, result.messageId));
    } catch {
      update(
        append(
          withQuestion,
          "ai",
          "I could not reach my side of things just then. Your plan is unaffected — please try again in a moment.",
        ),
      );
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      <View style={s.coachHead}>
        <View style={s.coachAvatar}>
          <Sparkles size={20} color={C.greenDeep} />
        </View>
        <View style={s.flex}>
          <Text style={s.coachName}>{COACH_NAME}</Text>
          <Text style={s.coachRole}>Your coach in the app · always here</Text>
        </View>
      </View>

      {hasHumanCoach && next && (
        <View style={s.session}>
          <Text style={s.sessionLabel}>NEXT SESSION WITH YOUR COACH</Text>
          <Text style={s.sessionTitle}>{next.type}</Text>
          <Text style={s.sessionMeta}>
            {next.dayOffset === 0
              ? "Today"
              : `In ${next.dayOffset} day${next.dayOffset === 1 ? "" : "s"}`}{" "}
            · {next.time}
          </Text>
        </View>
      )}

      {messages.length === 0 && (
        <Card>
          <Text style={s.coachIntro}>
            I can explain what your plan is doing and why, help you decide what
            to do on a hard day, and answer the ordinary questions. I am part of
            the app, not a doctor — and I cannot change your plan, because that
            follows what you log.
          </Text>
        </Card>
      )}

      {messages.length > shown && (
        <Pressable
          accessibilityRole="button"
          style={s.showEarlier}
          onPress={() => setShown(shown + PAGE)}
        >
          <Text style={s.showEarlierText}>
            Show earlier messages ({messages.length - shown} more)
          </Text>
        </Pressable>
      )}

      {messages.slice(-shown).map((m) => {
        const mine = m.from === "member";
        const who =
          m.from === "member"
            ? "You"
            : m.from === "ai"
              ? COACH_NAME
              : m.from === "coach"
                ? "Your coach"
                : "Bharosa";
        return (
          <View
            key={m.id}
            style={[
              s.messageBubble,
              mine ? s.memberBubble : s.coachBubble,
              m.from === "coach" && s.humanCoachBubble,
            ]}
          >
            <View style={s.rowBetween}>
              <Text
                style={[
                  s.messageFrom,
                  !mine && s.messageFromCoach,
                  m.from === "coach" && s.messageFromHuman,
                ]}
              >
                {who}
              </Text>
              <Text style={s.messageTime}>{m.time}</Text>
            </View>
            <Text style={[s.messageBody, mine && s.memberMessageText]}>
              {m.body}
            </Text>
          </View>
        );
      })}

      {thinking && (
        <View style={[s.messageBubble, s.coachBubble]}>
          <Text style={s.messageFromCoach}>{COACH_NAME}</Text>
          <View style={s.rowInline}>
            <ActivityIndicator size="small" color={C.green} />
            <Text style={s.thinkingText}>Reading your plan…</Text>
          </View>
        </View>
      )}

      {messages.length === 0 && !thinking && (
        <View style={s.openerWrap}>
          {COACH_OPENERS.map((opener) => (
            <Pressable
              key={opener}
              accessibilityRole="button"
              style={({ pressed }) => [s.opener, pressed && s.pressed]}
              onPress={() => ask(opener)}
            >
              <Text style={s.openerText}>{opener}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={s.composer}>
        <TextInput
          style={s.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Ask ${COACH_NAME} anything…`}
          placeholderTextColor={C.faint}
          multiline
          editable={!thinking}
          onSubmitEditing={() => ask(draft)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={thinking || !draft.trim()}
          style={[s.sendButton, (thinking || !draft.trim()) && s.sendDisabled]}
          onPress={() => ask(draft)}
        >
          <Text style={s.sendButtonText}>↑</Text>
        </Pressable>
      </View>

      {messages.length > 6 && (
        <Pressable
          accessibilityRole="button"
          style={s.secondaryButton}
          onPress={scrollToTop}
        >
          <Text style={s.secondaryButtonText}>Back to the top</Text>
        </Pressable>
      )}

      {!hasHumanCoach && (
        <Card style={s.upsell}>
          <View style={s.rowInline}>
            <UserRound size={16} color={C.marigold} />
            <Text style={s.upsellKicker}>WANT A PERSON AS WELL?</Text>
          </View>
          <Text style={s.upsellTitle}>Add a human coach</Text>
          <Text style={s.upsellCopy}>
            {COACH_NAME} explains your plan and is here at two in the morning. A
            coach does the things software should not: reads your blood work,
            watches you move, and overrides the plan when your body disagrees
            with it.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [s.upsellButton, pressed && s.pressed]}
            onPress={() => {
              // An actual message into the conversation, which a coach sees in
              // the console. No fake checkout, and no claim that somebody is
              // already assigned.
              update(
                append(
                  doc,
                  "member",
                  "I would like to know more about adding a human coach.",
                ),
              );
              Alert.alert(
                "Noted",
                "That is in your conversation now. Coaching is not on sale yet — when it is, this is where it will appear.",
              );
            }}
          >
            <Text style={s.upsellButtonText}>Tell me more</Text>
            <ChevronRight size={16} color={C.greenDeep} />
          </Pressable>
        </Card>
      )}

      <Text style={s.responseNote}>
        {COACH_NAME} is software, and she is not a substitute for medical care.
        For anything urgent, call your local emergency number — 112 in India.
        This is not an emergency channel.
        {hasHumanCoach
          ? " Where your coach has set something, that stands."
          : ""}
      </Text>
    </>
  );
}
