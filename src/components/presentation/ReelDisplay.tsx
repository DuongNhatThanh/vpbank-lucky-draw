import { ReelDigit } from "./ReelDigit";

export interface ReelDisplayProps {
  code: string | null;
  settledDigits: number;
  isGrandPrize?: boolean;
}

export function ReelDisplay({ code, settledDigits, isGrandPrize = false }: ReelDisplayProps) {
  const digits = code && /^\d{4}$/.test(code) ? code.split("") : Array.from({ length: 4 }, () => "");

  return (
    <div className={`reel-display${isGrandPrize ? " reel-display--grand" : ""}`} aria-label="Winning code reels">
      {digits.map((digit, index) => (
        <ReelDigit key={`${digit}-${index}`} digit={digit} spinning={index >= settledDigits} delayMs={index * 96} isGrandPrize={isGrandPrize} />
      ))}
    </div>
  );
}
