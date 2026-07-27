import { ReactNode } from "react";
import type { AurinaState } from "../v3/types";

type Props = {
  children: ReactNode;
  state?: AurinaState;
  voice?: string;
};

export default function Stage({ children, state, voice }: Props) {
  return (
    <main
      data-state={state}
      data-voice={voice}
      style={{
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "32px 40px 48px",
        display: "flex",
        flexDirection: "column",
        gap: "28px",
      }}
    >
      {children}
    </main>
  );
}