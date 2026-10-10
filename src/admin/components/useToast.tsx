import { useCallback, useEffect, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(t);
  }, [message]);
  const node = message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
  return { show: useCallback((m: string) => setMessage(m), []), node };
}
