import { useId } from "react";
import lightMark from "../../../docs/brand/assets/ai-for-boss-mark.svg";
import darkMark from "../../../docs/brand/assets/ai-for-boss-mark-dark.svg";
import "./brand-mark.css";

export default function BrandMark({ active = false }: { active?: boolean }) {
  const gradientId = useId();
  return (
    <span className={"brand-mark" + (active ? " brand-mark--active" : "")} data-model-active={active} aria-hidden="true">
      {active ? <svg viewBox="0 0 100 100" fill="none" focusable="false">
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38BDF8" /><stop offset="1" stopColor="#4F46B8" />
        </linearGradient></defs>
        <path className="brand-mark__ring" d="M50,15 A35,35 0 1 1 16,59" stroke={`url(#${gradientId})`}
          strokeWidth="13" strokeLinecap="round" fill="none" />
        <circle className="brand-mark__core" cx="50" cy="50" r="17" />
      </svg> : <>
      <img className="brand-mark__light" src={lightMark} alt="" />
      <img className="brand-mark__dark" src={darkMark} alt="" />
      </>}
    </span>
  );
}
