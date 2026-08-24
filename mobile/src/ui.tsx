/**
 * The two pieces every screen needs, and nothing else.
 *
 * `App.tsx` grew past seven thousand lines with every screen, every helper
 * and every piece of shared furniture in one file. Pulling the screens apart
 * has to start here, because a screen cannot move out until the things it
 * reaches for from module scope can be imported instead.
 *
 * Deliberately small. This is not a component library and should not become
 * one: styles live in `design/styles.ts`, and a component used by exactly one
 * screen belongs with that screen.
 */

import { createContext, useContext } from "react";
import { View } from "react-native";

import { s } from "./design/styles";

/**
 * Scrolling the page back to the top when a screen changes.
 *
 * A context rather than a prop because the scroll view belongs to the shell
 * and the screens that need it are several levels down. Without it a member
 * who opened a section from halfway down a list arrived halfway down the new
 * screen, which read as the app having lost her place.
 */
export const ScrollTopContext = createContext<() => void>(() => {});

export function useScrollToTop() {
  return useContext(ScrollTopContext);
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
