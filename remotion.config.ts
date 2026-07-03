import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Concurrency left to Remotion's default (auto-detected from CPU cores).
