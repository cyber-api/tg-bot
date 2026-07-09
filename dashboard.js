import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export function setupDashboardRoutes(app, getBotState, restartBot, stopBot, startBot) {
  // Status API
  app.get("/api/status", async (req, res) => {
    const { botStatus, botStartTime, dbInstance } = getBotState();
    let userCount = 0;
    let threadCount = 0;
    try {
      if (dbInstance && dbInstance.userModel && typeof dbInstance.userModel.countDocuments === 'function') {
        userCount = await dbInstance.userModel.countDocuments();
      }
      if (dbInstance && dbInstance.threadModel && typeof dbInstance.threadModel.countDocuments === 'function') {
        threadCount = await dbInstance.threadModel.countDocuments();
      }
    } catch (e) {}

    res.json({
      status: botStatus,
      uptime: botStatus === "running" ? Math.floor((Date.now() - botStartTime) / 1000) : 0,
      databaseType: dbInstance ? dbInstance.dbType : "sqlite",
      userCount,
      threadCount,
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    });
  });

  // Config API
  app.get("/api/config", (req, res) => {
    try {
      const configRaw = fs.readFileSync(path.resolve(process.cwd(), "config.json"), "utf-8");
      res.json(JSON.parse(configRaw));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const newConfig = req.body;
      fs.writeFileSync(path.resolve(process.cwd(), "config.json"), JSON.stringify(newConfig, null, 2), "utf-8");
      
      await stopBot();
      await startBot();

      res.json({ success: true, message: "Configuration saved and bot restarted successfully!" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Logs API
  app.get("/api/logs", (req, res) => {
    const { recentLogs } = getBotState();
    res.json({ logs: recentLogs });
  });

  // Users API
  app.get("/api/users", async (req, res) => {
    try {
      const { dbInstance } = getBotState();
      if (!dbInstance || !dbInstance.userModel) {
        return res.json([]);
      }
      const users = await dbInstance.userModel.find({});
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // User Ban Toggle API
  app.post("/api/users/ban", async (req, res) => {
    const { userID, banned } = req.body;
    try {
      const { dbInstance } = getBotState();
      if (!dbInstance || !dbInstance.userModel) {
        return res.status(400).json({ error: "Database not initialized" });
      }
      const user = await dbInstance.userModel.findOneAndUpdate({ userID }, { banned }, { new: true });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, user });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Threads API
  app.get("/api/threads", async (req, res) => {
    try {
      const { dbInstance } = getBotState();
      if (!dbInstance || !dbInstance.threadModel) {
        return res.json([]);
      }
      const threads = await dbInstance.threadModel.find({});
      const serialized = threads.map(t => {
        let usersObj = {};
        if (t.users instanceof Map) {
          for (let [k, v] of t.users.entries()) {
            usersObj[k] = v;
          }
        } else if (t.users) {
          usersObj = t.users;
        }
        return {
          chatId: t.chatId,
          sorthelp: t.sorthelp,
          usersCount: Object.keys(usersObj).length,
          users: usersObj
        };
      });
      res.json(serialized);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Commands API
  app.get("/api/commands", (req, res) => {
    try {
      const commandsDir = path.resolve(process.cwd(), 'scripts', 'commands');
      const commandFiles = fs.existsSync(commandsDir) ? fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') && file !== 'test.js') : [];
      const cmds = commandFiles.map(file => {
        try {
          const cmdPath = path.join(commandsDir, file);
          delete require.cache[require.resolve(cmdPath)];
          const cmd = require(cmdPath);
          return cmd.config || { name: file };
        } catch (e) {
          return { name: file, error: true };
        }
      });
      res.json(cmds);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Bot Control API
  app.post("/api/bot/control", async (req, res) => {
    const { action } = req.body;
    try {
      if (action === 'start') {
        const { botStatus } = getBotState();
        if (botStatus !== "running") await startBot();
      } else if (action === 'stop') {
        await stopBot();
      } else if (action === 'restart') {
        await stopBot();
        await startBot();
      }
      const { botStatus } = getBotState();
      res.json({ success: true, status: botStatus });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
