/**
 * Rascunho local para evitar perda acidental (fechar aba, cair a rede).
 * É só conveniência: o registro definitivo é o envio ao servidor (PostgreSQL).
 */
import { useEffect, useRef, useState } from "react";
import type { ProfileInput } from "../../shared/domain.ts";
import type { Draft } from "./types.ts";

function newKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

export function emptyDraft(): Draft {
  return { idempotencyKey: newKey(), startedAt: Date.now(), step: 0, consent: false, profile: { profession: null, answers: {} }, answers: {} };
}

/** Rascunho salvo antes da tela de perfil configurável: três campos fixos no próprio perfil. */
function upgradeProfile(profile: unknown): ProfileInput {
  const p = (profile ?? {}) as Record<string, unknown>;
  if (p.answers && typeof p.answers === "object") return { profession: (p.profession as string) || null, answers: p.answers as ProfileInput["answers"] };
  const legacy = Object.fromEntries(
    ["experienceYears", "simulatorExperience", "iventExperience"].filter((k) => typeof p[k] === "string" && p[k]).map((k) => [k, p[k] as string]),
  );
  return { profession: (p.profession as string) || null, answers: legacy };
}

function read(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    return parsed && typeof parsed.idempotencyKey === "string" && parsed.answers ? { ...parsed, profile: upgradeProfile(parsed.profile) } : null;
  } catch {
    return null;
  }
}

export function useDraft(storageKey: string | null) {
  const [draft, setDraft] = useState<Draft>(() => (storageKey && read(storageKey)) || emptyDraft());
  const [restored] = useState(() => Boolean(storageKey && read(storageKey) && Object.keys(read(storageKey)!.answers).length));
  const keyRef = useRef(storageKey);
  keyRef.current = storageKey;

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // armazenamento indisponível (aba privada): segue sem rascunho
    }
  }, [draft, storageKey]);

  const clear = () => {
    try {
      if (keyRef.current) localStorage.removeItem(keyRef.current);
    } catch {
      // ignore
    }
  };

  const restart = () => {
    clear();
    setDraft(emptyDraft());
  };

  return { draft, setDraft, clear, restart, restored };
}
