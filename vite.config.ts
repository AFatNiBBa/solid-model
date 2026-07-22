
import dtsPlugin from "unplugin-dts/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        dtsPlugin({
            include: [ "src" ],
            bundleTypes: true
        })
    ],
    build: {
        minify: false,
        target: "ESNext",
        lib: {
            entry: "src/index.ts",
            fileName: "index",
            name: "solidModel"
        },
        rollupOptions: {
            output: { globals: x => x.replace(/\W(\w)/g, (_, x) => x.toUpperCase()) },
            external: x => !x.match(/^(?:\.|\/|\w:)/)
        }
    }
});