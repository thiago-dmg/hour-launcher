import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultTaskName = "Hour Launcher Daily";
const defaultTime = "18:10";

type ScheduleOptions = {
  projectRoot: string;
  taskName: string;
  hour: number;
  minute: number;
};

export function buildLaunchCommand(projectRoot: string): string {
  return `cd "${projectRoot}" && npm run launch -- --activities config/activities.local.json --yes`;
}

export function buildCronBlock(options: ScheduleOptions): string {
  return [
    `# BEGIN ${options.taskName}`,
    `${options.minute} ${options.hour} * * 1-5 ${buildLaunchCommand(options.projectRoot)}`,
    `# END ${options.taskName}`
  ].join("\n");
}

export function buildWindowsSchedulerCommand(options: ScheduleOptions): string {
  const time = formatTime(options.hour, options.minute);
  const projectRoot = escapePowerShellSingleQuoted(options.projectRoot);
  const taskName = escapePowerShellSingleQuoted(options.taskName);
  const launchCommand = `npm run launch -- --activities config/activities.local.json --yes`;

  return [
    `$Action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c ${launchCommand}' -WorkingDirectory '${projectRoot}'`,
    `$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At ${time}`,
    `$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive`,
    `Register-ScheduledTask -TaskName '${taskName}' -Action $Action -Trigger $Trigger -Principal $Principal -Description 'Lancamento automatico diario do Hour Launcher' -Force`
  ].join("; ");
}

export async function installScheduler(options: ScheduleOptions, platform = process.platform): Promise<void> {
  if (platform === "win32") {
    await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", buildWindowsSchedulerCommand(options)]);
    return;
  }

  await installCron(options);
}

export async function removeScheduler(taskName = defaultTaskName, platform = process.platform): Promise<void> {
  if (platform === "win32") {
    const escapedTaskName = escapePowerShellSingleQuoted(taskName);
    await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `Unregister-ScheduledTask -TaskName '${escapedTaskName}' -Confirm:$false`]);
    return;
  }

  const current = await readCrontab();
  await writeCrontab(removeCronBlock(current, taskName));
}

function parseTime(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Horario invalido: ${value}. Use HH:mm, por exemplo 18:10.`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Horario invalido: ${value}. Use HH:mm entre 00:00 e 23:59.`);
  }

  return { hour, minute };
}

async function installCron(options: ScheduleOptions): Promise<void> {
  const current = await readCrontab();
  const next = [removeCronBlock(current, options.taskName).trim(), buildCronBlock(options)].filter(Boolean).join("\n\n");
  await writeCrontab(`${next}\n`);
}

async function readCrontab(): Promise<string> {
  const result = await execFileAsync("crontab", ["-l"]).catch((error: unknown) => {
    const maybeError = error as { code?: number; stdout?: string };
    if (maybeError.code === 1) {
      return { stdout: "" };
    }

    throw error;
  });

  return result.stdout;
}

async function writeCrontab(content: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("crontab", ["-"], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Falha ao gravar crontab: ${stderr.trim()}`));
    });

    child.stdin.end(content);
  });
}

function removeCronBlock(crontab: string, taskName: string): string {
  const escapedName = escapeRegExp(taskName);
  return crontab.replace(new RegExp(`# BEGIN ${escapedName}[\\s\\S]*?# END ${escapedName}\\n?`, "g"), "").trim();
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main(): Promise<void> {
  const action = process.argv[2] ?? "install";
  const timeArgIndex = process.argv.indexOf("--time");
  const time = parseTime(timeArgIndex >= 0 ? process.argv[timeArgIndex + 1] : defaultTime);
  const options: ScheduleOptions = {
    projectRoot: process.cwd(),
    taskName: defaultTaskName,
    hour: time.hour,
    minute: time.minute
  };

  if (action === "remove") {
    await removeScheduler(options.taskName);
    console.log(`Agendamento removido: ${options.taskName}`);
    return;
  }

  if (action !== "install") {
    throw new Error(`Acao invalida: ${action}. Use install ou remove.`);
  }

  await installScheduler(options);
  console.log(`Agendamento criado: ${options.taskName} de segunda a sexta as ${formatTime(options.hour, options.minute)}.`);
}

if (process.argv[1]?.endsWith("setup-scheduler.ts")) {
  await main();
}
