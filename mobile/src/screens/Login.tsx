import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { login, requestPasswordHelp, signup } from "../api";
import { s } from "../design/styles";
import { C } from "../design/tokens";

export function Login({
  onSuccess,
  onDemo,
}: {
  onSuccess: (token: string) => void;
  onDemo: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async () => {
    if (!username.trim()) return setError("Enter your username.");
    if (mode !== "help" && !password) return setError("Enter your password.");
    if (mode === "signup" && !name.trim()) return setError("Enter your name.");
    if (mode === "signup" && !/^\S+@\S+\.\S+$/.test(email.trim()))
      return setError("Enter a valid email for account recovery.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signin") onSuccess(await login(username.trim(), password));
      if (mode === "signup")
        onSuccess(
          await signup({
            name: name.trim(),
            email: email.trim(),
            username: username.trim(),
            password,
            code: joinCode.trim() || undefined,
          }),
        );
      if (mode === "help")
        setNotice((await requestPasswordHelp(username.trim())).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  return (
    <KeyboardAvoidingView
      style={s.loginPage}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          s.authScroll,
          { paddingBottom: 28 + insets.bottom, paddingTop: insets.top },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient colors={[C.greenDeep, "#0A6264"]} style={s.authHero}>
          <Image source={require("../../assets/icon-v2.png")} style={s.brandIcon} />
          <Text style={s.brand}>BHAROSA WELLNESS</Text>
          <Text style={s.loginTitle}>
            {mode === "signup"
              ? "Begin with support."
              : mode === "help"
                ? "Regain access."
                : "Welcome back."}
          </Text>
          <Text style={s.loginCopy}>
            {mode === "signup"
              ? "Create your private member space and meet your coach inside."
              : mode === "help"
                ? "Tell us which account needs help. We never reveal whether a username exists."
                : "Your plan, your progress, and your coach’s guidance—in one private place."}
          </Text>
        </LinearGradient>
        <View style={s.authCard}>
          {mode === "signup" && (
            <>
              <Text style={s.inputLabel}>Your name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                textContentType="name"
              />
              <Text style={s.inputLabel}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <Text style={s.fieldHint}>
                Used only for account notices and secure password recovery.
              </Text>
            </>
          )}
          <Text style={s.inputLabel}>
            {mode === "help" ? "Username or email" : "Username"}
          </Text>
          <TextInput
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            textContentType="username"
          />
          {mode !== "help" && (
            <>
              <Text style={s.inputLabel}>Password</Text>
              <TextInput
                style={s.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                textContentType={mode === "signup" ? "newPassword" : "password"}
              />
              {mode === "signup" && (
                <Text style={s.fieldHint}>Use at least 8 characters.</Text>
              )}
            </>
          )}
          {mode === "signup" && (
            <>
              <Text style={s.inputLabel}>Join code</Text>
              {/* Was autoCapitalize="characters", which force-uppercased every
                  keystroke while the server compares case-sensitively — so any
                  code containing a lowercase letter was impossible to type on a
                  phone. Nothing here may alter what she typed. */}
              <TextInput
                style={s.input}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                value={joinCode}
                onChangeText={setJoinCode}
              />
              <Text style={s.fieldHint}>
                Exactly as it was sent to you, including capitals.
              </Text>
            </>
          )}
          {!!error && <Text style={s.error}>{error}</Text>}
          {!!notice && <Text style={s.notice}>{notice}</Text>}
          <Pressable
            style={({ pressed }) => [s.primaryButton, pressed && s.pressed]}
            accessibilityRole="button"
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryButtonText}>
                {mode === "signup"
                  ? "Create account"
                  : mode === "help"
                    ? "Email reset link"
                    : "Sign in"}
              </Text>
            )}
          </Pressable>
          {mode === "signin" && (
            <Pressable accessibilityRole="button" onPress={() => changeMode("help")}>
              <Text style={s.textButton}>Forgot your password?</Text>
            </Pressable>
          )}
          <View style={s.authDivider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>OR</Text>
            <View style={s.dividerLine} />
          </View>
          <Pressable
            style={({ pressed }) => [s.secondaryButton, pressed && s.pressed]}
            accessibilityRole="button"
            onPress={() => changeMode(mode === "signup" ? "signin" : "signup")}
            disabled={busy}
          >
            <Text style={s.secondaryButtonText}>
              {mode === "signup"
                ? "I already have an account"
                : "Create a member account"}
            </Text>
          </Pressable>
          {__DEV__ && (
            <Pressable
              style={({ pressed }) => [s.secondaryButton, pressed && s.pressed]}
              accessibilityRole="button"
              onPress={onDemo}
              disabled={busy}
            >
              <Text style={s.secondaryButtonText}>Explore demo</Text>
            </Pressable>
          )}
          {mode === "help" && (
            <Pressable accessibilityRole="button" onPress={() => changeMode("signin")}>
              <Text style={s.textButton}>Back to sign in</Text>
            </Pressable>
          )}
        </View>
        <Text style={s.privacyNote}>
          Your wellness information is visible only to you and your authorised
          coach. If you choose to join a circle, the people you accept see how
          much of your plan you have done — never your meals, reports, check-ins
          or messages.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Scrolling back to the top when the screen changes.
 *
 * Every screen renders into one ScrollView that is never remounted, so React
 * Native keeps whatever offset the last screen was left at. Opening the record
 * from a scrolled-down Plan tab landed the member at the bottom of it, with the
 * heading somewhere above her — and the same happened for the movement session
 * and for opening an article.
 *
 * Only the ScrollView can reset its own offset, so it publishes the reset here
 * and screens that swap in place call it as they navigate. Tab and section
 * changes are handled centrally in the shell; this is for the screens that
 * change inside a tab, where the shell cannot see it happen.
 */

export type AuthMode = "signin" | "signup" | "help";
