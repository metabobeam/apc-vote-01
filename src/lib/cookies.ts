export interface VoteCookieData {
  employeeNumber: string;
  selectedProductIds: string[];
  productNumbers: string[];
  timestamp: string;
}

const VOTE_COOKIE_KEY = "apc_my_vote";
const RESULTS_AUTH_KEY = "apc_results_auth";
const ADMIN_PASS_KEY = "apc_admin_pass";

/** 投票内容をcookieに保存 (90日間) */
export function saveVoteCookie(data: VoteCookieData): void {
  const json = encodeURIComponent(JSON.stringify(data));
  const maxAge = 90 * 24 * 60 * 60; // 90日
  document.cookie = `${VOTE_COOKIE_KEY}=${json}; max-age=${maxAge}; path=/; SameSite=Strict`;
}

/** cookieから自分の投票内容を取得 */
export function getVoteCookie(): VoteCookieData | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${VOTE_COOKIE_KEY}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

/** 今日の日付を "YYYY-MM-DD" 形式で返す */
function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE"); // "2026-03-30" 形式
}

/** 管理者認証を当日有効で localStorage に保存 */
export function setResultsAuth(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(RESULTS_AUTH_KEY, todayStr());
}

/** 管理者認証が当日有効かどうか確認 */
export function getResultsAuth(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(RESULTS_AUTH_KEY) === todayStr();
}

/** 管理者認証をクリア */
export function clearResultsAuth(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(RESULTS_AUTH_KEY);
  localStorage.removeItem(ADMIN_PASS_KEY);
}

/** 管理者パスワードを localStorage に保存（認証済みの場合のみ）*/
export function saveAdminPass(password: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ADMIN_PASS_KEY, password);
}

/** 保存された管理者パスワードを取得 */
export function getAdminPass(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(ADMIN_PASS_KEY) ?? "";
}
