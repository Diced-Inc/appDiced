/** Returns YYYY-MM-DD string in America/Sao_Paulo timezone */
export function toBrazilDateStr(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
