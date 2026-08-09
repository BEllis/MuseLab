import { describe, expect, it } from "vitest";
import {
  fitAspectRatioInBox,
  letterboxContentRect,
  STAGE_CONTENT_ASPECT_RATIO,
} from "./thumbnailAspectRatio";

describe("fitAspectRatioInBox", () => {
  it("fills an exact 16:9 frame", () => {
    expect(fitAspectRatioInBox(1920, 1080, STAGE_CONTENT_ASPECT_RATIO)).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("fits 16:9 inside a 4:3 frame (letterbox)", () => {
    expect(fitAspectRatioInBox(1600, 1200, STAGE_CONTENT_ASPECT_RATIO)).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it("fits 16:9 inside a portrait frame (letterbox)", () => {
    expect(fitAspectRatioInBox(1080, 1920, STAGE_CONTENT_ASPECT_RATIO)).toEqual({
      width: 1080,
      height: 607.5,
    });
  });

  it("fits 16:9 inside an ultrawide frame (pillarbox)", () => {
    expect(fitAspectRatioInBox(2560, 1080, STAGE_CONTENT_ASPECT_RATIO)).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});

describe("letterboxContentRect", () => {
  it("centers content with no bars on 16:9", () => {
    expect(letterboxContentRect(1280, 720)).toEqual({
      width: 1280,
      height: 720,
      left: 0,
      top: 0,
    });
  });

  it("adds top/bottom bars for portrait targets", () => {
    expect(letterboxContentRect(1080, 1920)).toEqual({
      width: 1080,
      height: 607.5,
      left: 0,
      top: (1920 - 607.5) / 2,
    });
  });

  it("adds left/right bars for 4:3 targets", () => {
    expect(letterboxContentRect(1600, 1200)).toEqual({
      width: 1600,
      height: 900,
      left: 0,
      top: 150,
    });
  });

  it("adds left/right bars when the frame is wider than 16:9", () => {
    // 21:9 ≈ 2560×1080
    expect(letterboxContentRect(2560, 1080)).toEqual({
      width: 1920,
      height: 1080,
      left: 320,
      top: 0,
    });
  });

  it("returns zeros for an empty box", () => {
    expect(letterboxContentRect(0, 100)).toEqual({
      width: 0,
      height: 0,
      left: 0,
      top: 0,
    });
  });
});
