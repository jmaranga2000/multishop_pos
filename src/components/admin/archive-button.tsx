"use client";

import React from "react";

export function ArchiveButton({ shopId }: { shopId: string }) {
  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    const ok = confirm("Are you sure you want to archive this shop? It will be hidden from lists.");
    if (!ok) {
      e.preventDefault();
      return;
    }
    // allow form submission to proceed
  }

  return (
    <form method="post">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="isArchived" value="true" />
      <button type="submit" onClick={onClick} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-rose-600">Archive</button>
    </form>
  );
}

export default ArchiveButton;
