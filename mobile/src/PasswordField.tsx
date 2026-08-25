/**
 * A password box you can look at.
 *
 * There was no way to see what you had typed. On a phone keyboard, with a
 * password you have just invented and are about to be held to, that is the
 * moment people give up and pick something they will forget — or mistype the
 * same thing twice and get locked out of an app they signed up for a minute
 * ago.
 *
 * ## The character that flashes before it becomes a dot
 *
 * Android reveals the last character typed in a password field for about a
 * second. That is the platform's own behaviour, governed by a system setting
 * (Settings → Privacy → "Show passwords"), and an app cannot turn it off from
 * here — a control that overrode it would be overriding an accessibility
 * choice somebody made deliberately.
 *
 * What the app *can* do is not make it worse, which it was:
 *
 * - The field had no `autoCapitalize`, so Android capitalised the first
 *   letter of every password. Anyone typing a lowercase password got a
 *   capital and no way to see it.
 * - It had no `autoComplete`, which is what tells Android this is a password
 *   at all rather than ordinary text with the dots turned on. Without it the
 *   platform can pick the "visible password" input type, where the reveal is
 *   not brief at all.
 *
 * With both set, and a toggle to see the whole thing, the flash is the
 * platform's and the rest is ours.
 */

import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

import { s } from "./design/styles";
import { C } from "./design/tokens";

export function PasswordField({
  value,
  onChangeText,
  onSubmitEditing,
  /** A new password being chosen, rather than an existing one being recalled. */
  isNew = false,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  isNew?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.passwordRow}>
      <TextInput
        style={[s.input, s.passwordInput]}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textContentType={isNew ? "newPassword" : "password"}
        autoComplete={isNew ? "new-password" : "current-password"}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        accessibilityState={{ checked: visible }}
        style={s.passwordReveal}
        onPress={() => setVisible(!visible)}
        /* Generous, because it sits beside a field people are already
           mistyping and a near-miss here reads as the app ignoring them. */
        hitSlop={10}
      >
        {visible ? (
          <EyeOff size={18} color={C.soft} />
        ) : (
          <Eye size={18} color={C.soft} />
        )}
      </Pressable>
    </View>
  );
}
