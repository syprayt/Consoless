import { KNOWN } from "./known"
import type { CategoryId } from "./taxonomy"

const RULES: Array<[RegExp, CategoryId]> = [
  [/^(git|node|npm|npx|pnpm|yarn|python|pip|ruby|gem|php|perl|java|javac|go|cargo|rustc|rustup|docker|podman|kubectl|gcc|clang|make|cmake|ninja|vim|nvim|emacs|nano|code|cursor|adb|bundle|rails|lua|gh|deno|bun)/, "dev"],
  [/^(brew|port|mas|apt|pacman)/, "packages"],
  [/^(tar|zip|unzip|gzip|gunzip|bzip2|bunzip2|xz|7z|zipinfo|zcat)/, "archive"],
  [/^(say|afplay|afconvert|screencapture|sips|qlmanage|ffmpeg|ffplay)/, "media"],
  [/net|dns|ssh|http|curl|wget|ping|wifi|route|arp|ipconfig|ifconfig|traceroute/, "network"],
  [/^(ls|cp|mv|rm|mkdir|rmdir|ln|chmod|chown|open|find|file|stat|ditto|rsync|basename|dirname|realpath|readlink|pwd|cd)/, "files"],
  [/^(grep|egrep|fgrep|sed|awk|gawk|sort|uniq|cut|tr|diff|comm|cat|less|more|head|tail|wc|tee|column|paste|join|fmt|fold|nl|rev|strings|man)/, "text"],
  [/^(ps|top|htop|kill|killall|pkill|launchctl|sysctl|diskutil|pmset|shutdown|reboot|halt|uname|whoami|id|date|uptime|sw_vers|hostname|system_profiler|ioreg)/, "system"],
  [/^(echo|alias|history|export|which|printenv|env|clear|printf|test|true|false|sleep|time|xargs|nice|nohup|source|pushd|popd)/, "shell"],
]

export function categoryOf(name: string): CategoryId {
  const known = KNOWN[name]
  if (known) return known.category
  const lower = name.toLowerCase()
  for (const [pattern, category] of RULES) {
    if (pattern.test(lower)) return category
  }
  return "other"
}
