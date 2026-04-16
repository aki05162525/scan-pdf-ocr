"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const LANGUAGES = [
  { value: "jpn", label: "日本語" },
  { value: "jpn+eng", label: "日本語 + 英語" },
];

export default function LanguageSelect({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        OCR言語
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
