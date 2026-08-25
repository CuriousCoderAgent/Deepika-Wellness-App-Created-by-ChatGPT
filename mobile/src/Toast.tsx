/**
 * A sentence that appears for a moment and goes away.
 *
 * For the case where the app declines to do something and needs to say so
 * without stopping her. Choosing a fourth goal did nothing at all — the tap
 * was swallowed, the option stayed unselected, and nothing anywhere said why.
 * The counter above the list said "3/3 selected", but by the time she has
 * scrolled to the last group it is off screen, and reading a counter is not
 * what anyone does while tapping.
 *
 * Deliberately not an Alert. A modal that must be dismissed treats a mistaken
 * tap as an error to be acknowledged, which is far too much ceremony for
 * "that is three already". This says its piece and leaves.
 *
 * ## Why it lives at the shell
 *
 * It renders above the scroll view rather than inside it, through a context,
 * the same way `useScrollToTop` reaches the shell's scroll position. A toast
 * rendered inside the list would scroll away with the list — which is exactly
 * where it would not be seen, since the tap that triggered it happened
 * wherever she had scrolled to.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

import { s } from "./design/styles";

const ToastContext = createContext<(message: string) => void>(() => {});

/** Say something, briefly. Safe to call from anywhere below the shell. */
export function useToast() {
  return useContext(ToastContext);
}

/** How long it stays. Long enough to read twice, short enough to ignore. */
const VISIBLE_MS = 2600;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(({ finished }) => {
          /* Only clear if the fade actually completed. A second message
             arriving mid-fade restarts it, and clearing here would blank the
             new one. */
          if (finished) setMessage(null);
        });
      }, VISIBLE_MS);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message !== null && (
        /* pointerEvents none: it floats over the list she is still using, and
           must never eat the next tap. */
        <Animated.View
          pointerEvents="none"
          style={[s.toast, { opacity }]}
          accessibilityLiveRegion="polite"
        >
          <View style={s.toastPill}>
            <Text style={s.toastText}>{message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
