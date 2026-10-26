import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({plugins:[react()],base:"/optioncrafted-tools-demo/platform-preview/",build:{outDir:"dist"}});
