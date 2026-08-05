"use client";

import React from "react";

export function UnarchiveButton({ shopId }: { shopId: string }) {
  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    const ok = confirm("Unarchive this shop and restore it to the active list?");
    if (!ok) {
      e.preventDefault();
      return;
    }
  }

  return (
    <form method="post">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="isArchived" value="false" />
      <button type="submit" onClick={onClick} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-emerald-600">Unarchive</button>
    </form>
  );
}

export default UnarchiveButton;
