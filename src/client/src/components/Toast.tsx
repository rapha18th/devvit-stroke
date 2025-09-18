import React, { useEffect } from 'react';

type ToastProps = {
  msg: string | null;
  onClear: () => void;
  ms?: number;
};

export default function Toast({ msg, onClear, ms = 3000 }: ToastProps) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClear, ms);
    return () => clearTimeout(t);
  }, [msg, ms, onClear]);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}
