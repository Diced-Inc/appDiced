"use client";

import { useState } from "react";
import type { CountryRevenue } from "@/lib/types";

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

const countryNames: Record<string, string> = {
  US: "Estados Unidos",
  BR: "Brasil",
  IN: "Índia",
  DE: "Alemanha",
  GB: "Reino Unido",
  FR: "França",
  JP: "Japão",
  CA: "Canadá",
  AU: "Austrália",
  MX: "México",
  IT: "Itália",
  ES: "Espanha",
  KR: "Coreia do Sul",
  RU: "Rússia",
  NL: "Holanda",
  TR: "Turquia",
  SA: "Arábia Saudita",
  AR: "Argentina",
  PL: "Polônia",
  TH: "Tailândia",
  ID: "Indonésia",
  PH: "Filipinas",
  VN: "Vietnã",
  EG: "Egito",
  PK: "Paquistão",
  NG: "Nigéria",
  CO: "Colômbia",
  CL: "Chile",
  PE: "Peru",
  ZA: "África do Sul",
  PT: "Portugal",
  SE: "Suécia",
  NO: "Noruega",
  DK: "Dinamarca",
  FI: "Finlândia",
  BE: "Bélgica",
  AT: "Áustria",
  CH: "Suíça",
  SG: "Singapura",
  MY: "Malásia",
  TW: "Taiwan",
  HK: "Hong Kong",
  AE: "Emirados Árabes",
  IL: "Israel",
  UA: "Ucrânia",
  RO: "Romênia",
  CZ: "Tchéquia",
  GR: "Grécia",
  HU: "Hungria",
  IE: "Irlanda",
};

interface CountryRevenueTableProps {
  data: CountryRevenue[];
}

export function CountryRevenueTable({ data }: CountryRevenueTableProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data : data.slice(0, 10);

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nenhum dado de país disponível. Sincronize o AdMob.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-zinc-400">
              <th className="pb-3 pr-4 font-medium">#</th>
              <th className="pb-3 pr-4 font-medium">País</th>
              <th className="pb-3 pr-4 text-right font-medium">Receita</th>
              <th className="pb-3 pr-4 text-right font-medium hidden sm:table-cell">
                Impressões
              </th>
              <th className="pb-3 text-right font-medium hidden sm:table-cell">
                eCPM
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const ecpm =
                row.impressions > 0
                  ? Math.round((row.revenue / row.impressions) * 1000 * 100) /
                    100
                  : 0;

              return (
                <tr
                  key={row.countryCode}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="py-2.5 pr-4 text-zinc-500">{i + 1}</td>
                  <td className="py-2.5 pr-4">
                    <span className="mr-2">{countryFlag(row.countryCode)}</span>
                    <span className="text-white">
                      {countryNames[row.countryCode] ?? row.countryCode}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-emerald-400">
                    ${row.revenue.toFixed(2)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-zinc-300 hidden sm:table-cell">
                    {row.impressions.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-zinc-300 hidden sm:table-cell">
                    ${ecpm.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          {expanded ? "Ver menos" : `Ver mais (${data.length - 10} países)`}
        </button>
      )}
    </div>
  );
}
