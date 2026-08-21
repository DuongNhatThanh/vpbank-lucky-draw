import { ReelDigit } from "./ReelDigit";

export interface ReelDisplayProps {
  code: string | null;
  settledDigits: number;
  isGrandPrize?: boolean;
  celebrate?: boolean;
}

export function ReelDisplay({ code, settledDigits, isGrandPrize = false, celebrate = false }: ReelDisplayProps) {
  const digits = code && /^\d{4}$/.test(code) ? code.split("") : Array.from({ length: 4 }, () => "");

  return (
    <div
      className={[
        "reel-display",
        isGrandPrize ? "reel-display--grand" : "",
        celebrate ? "reel-display--winner" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Winning code reels"
    >
      {digits.map((digit, index) => (
        <ReelDigit
          key={`${digit}-${index}`}
          digit={digit}
          spinning={index >= settledDigits}
          delayMs={index * 96}
          isGrandPrize={isGrandPrize}
          winner={celebrate && index < settledDigits}
        />
      ))}
    </div>
  );
}