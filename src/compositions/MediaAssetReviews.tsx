import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { LiquidGlass } from "../components/LiquidGlass";
import { PersonEvidenceCard, QuoteSourceCard } from "../components/review";
import { BilingualSubtitles, SectionTitle } from "../components/review/shared";
import { colorTokens, typographyTokens } from "../design-tokens";
import { LayoutSurface } from "../layout-templates";
import { IdentityMark, identityAssets, personAssets, type MediaAssetDefinition } from "../media-assets";

const font = typographyTokens.family;
const PAGE_SIZE = 20;
const sortedPeople: MediaAssetDefinition[] = [...personAssets].sort((a, b) => {
  const rank = { candidate: 0, approved: 0, planned: 1, blocked: 2 } as const;
  return rank[a.status] - rank[b.status] || a.label.localeCompare(b.label);
});

export const personAssetReviewDefinitions = Array.from(
  { length: Math.ceil(sortedPeople.length / PAGE_SIZE) },
  (_, page) => ({
    id: `ReviewPersonAssetContactSheet${page + 1}`,
    page,
  }),
);

export const identityAssetReviewDefinitions = Array.from(
  { length: Math.ceil(identityAssets.length / PAGE_SIZE) },
  (_, page) => ({
    id: `ReviewIdentityAssetContactSheet${page + 1}`,
    page,
  }),
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const color =
    status === "approved" ? colorTokens.mint : status === "candidate" ? colorTokens.amber : colorTokens.paperMuted;
  return <span style={{ color, fontSize: 11, fontWeight: 850, letterSpacing: 1 }}>{status.toUpperCase()}</span>;
};

export const PersonAssetContactSheetReview: React.FC<{ page?: number }> = ({ page = 0 }) => {
  const items = sortedPeople.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(145deg,#07101d,#101927 54%,#070a10)",
        color: colorTokens.paper,
        fontFamily: font,
      }}
    >
      <div style={{ position: "absolute", left: 64, top: 46 }}>
        <SectionTitle
          eyebrow="PERSON ASSET REVIEW"
          title={`人物头像与安全降级 · ${page + 1}/${personAssetReviewDefinitions.length}`}
          accent={colorTokens.blue}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 166,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 13,
        }}
      >
        {items.map((asset) => (
          <LiquidGlass
            key={asset.id}
            padding="14px"
            radius={18}
            accent={asset.status === "candidate" ? `${colorTokens.amber}38` : `${colorTokens.blue}20`}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <IdentityMark
                entityId={asset.id}
                kind="person"
                label={asset.label}
                size={60}
                variant="circle"
                allowCandidate
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 820,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {asset.label}
                </div>
                <div style={{ marginTop: 5 }}>
                  <StatusPill status={asset.status} />
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 10,
                    opacity: 0.55,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {("source" in asset ? asset.source?.license : undefined) ?? "fallback only"}
                </div>
              </div>
            </div>
          </LiquidGlass>
        ))}
      </div>
      <div style={{ position: "absolute", left: 64, bottom: 34, fontSize: 13, opacity: 0.58 }}>
        CANDIDATE 仅供本轮人工核对身份、裁切与授权记录；未批准素材在生产渲染中自动使用姓名缩写。
      </div>
    </AbsoluteFill>
  );
};

export const IdentityAssetContactSheetReview: React.FC<{ page?: number }> = ({ page = 0 }) => {
  const items = identityAssets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(145deg,#08121d,#151625 58%,#090b10)",
        color: colorTokens.paper,
        fontFamily: font,
      }}
    >
      <div style={{ position: "absolute", left: 64, top: 46 }}>
        <SectionTitle
          eyebrow="IDENTITY ASSET REVIEW"
          title={`品牌、机构、媒体与国家标识 · ${page + 1}/${identityAssetReviewDefinitions.length}`}
          accent={colorTokens.violet}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 178,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 14,
        }}
      >
        {items.map((asset) => (
          <LiquidGlass key={asset.id} padding="16px" radius={20} accent={`${colorTokens.violet}28`}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <IdentityMark entityId={asset.id} kind={asset.kind} label={asset.label} size={58} allowCandidate />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 820,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {asset.label}
                </div>
                <div style={{ marginTop: 5, color: colorTokens.blue, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
                  {asset.kind.toUpperCase()}
                </div>
                <div style={{ marginTop: 5 }}>
                  <StatusPill status={asset.status} />
                </div>
              </div>
            </div>
          </LiquidGlass>
        ))}
      </div>
      <div style={{ position: "absolute", left: 64, bottom: 34, fontSize: 13, opacity: 0.58 }}>
        官方商标仅用于编辑语境中的指代，不代表背书；无法冻结的标识使用稳定文字徽章。
      </div>
    </AbsoluteFill>
  );
};

export const MediaAssetConnectionReview: React.FC = () => (
  <LayoutSurface templateId="speaker-center-right" backgroundSrc="review-assets/creator-placeholder.svg">
    <div style={{ position: "absolute", left: 64, top: 54, fontFamily: font }}>
      <SectionTitle
        eyebrow="DETERMINISTIC MEDIA ROUTING"
        title="理解内容，但不让模型直接选择文件"
        accent={colorTokens.mint}
      />
    </div>
    <div
      style={{
        position: "absolute",
        left: 62,
        top: 250,
        width: 790,
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: font,
      }}
    >
      {[
        ["口播", "识别人名与机构"],
        ["mediaIntent", "只记录语义 ID"],
        ["本地注册表", "授权、校验与变体"],
        ["组件", "正式素材或安全降级"],
      ].map(([title, detail], index) => (
        <React.Fragment key={title}>
          <LiquidGlass
            padding="19px 14px"
            radius={20}
            accent={`${[colorTokens.blue, colorTokens.violet, colorTokens.amber, colorTokens.mint][index]}38`}
            style={{ width: 172 }}
          >
            <div
              style={{
                color: [colorTokens.blue, colorTokens.violet, colorTokens.amber, colorTokens.mint][index],
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: 1,
              }}
            >
              {title}
            </div>
            <div style={{ marginTop: 10, fontSize: 16, fontWeight: 720, lineHeight: 1.35 }}>{detail}</div>
          </LiquidGlass>
          {index < 3 ? <div style={{ fontSize: 30, color: colorTokens.paperMuted }}>→</div> : null}
        </React.Fragment>
      ))}
    </div>
    <div style={{ position: "absolute", left: 64, top: 520, width: 760, display: "flex", gap: 15, fontFamily: font }}>
      {["donald_trump", "brand.ollama", "media.reuters", "country.us"].map((id, index) => {
        const kinds = ["person", "ai", "media", "country"] as const;
        return <IdentityMark key={id} entityId={id} kind={kinds[index]} label={id} size={78} allowCandidate />;
      })}
    </div>
    <BilingualSubtitles
      zh="所有外部素材都必须经过本地注册与审核"
      en="Every external asset is resolved and reviewed locally."
    />
  </LayoutSurface>
);

const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LayoutSurface templateId="speaker-right-overlay-left" backgroundSrc="review-assets/creator-placeholder.svg">
    {children}
  </LayoutSurface>
);

export const MediaAssetMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={180}>
        <Scene>
          <div style={{ position: "absolute", left: 64, top: 54 }}>
            <SectionTitle eyebrow="POLICY SIGNAL" title="关键人物如何改变市场预期" accent={colorTokens.blue} />
          </div>
          {/* biome-ignore lint/a11y/useValidAriaRole: role is the person's displayed job title, not a DOM ARIA role. */}
          <PersonEvidenceCard
            frame={frame}
            fps={fps}
            personId="donald_trump"
            allowCandidatePortrait
            name="Donald Trump"
            role="PRESIDENT OF THE UNITED STATES"
            quote="政策、产业与资本市场的变化，往往会同时影响企业决策。"
            evidence={[
              {
                eyebrow: "POLICY",
                title: "行政政策改变产业预期",
                meta: "贸易 · 科技 · 能源",
                accent: colorTokens.blue,
              },
              {
                eyebrow: "IMPACT",
                title: "市场快速重估相关资产",
                meta: "企业 · 资本 · 供应链",
                accent: colorTokens.mint,
              },
            ]}
          />
          <BilingualSubtitles
            zh="人物素材会先核验身份和授权来源"
            en="Portraits are identity- and rights-checked before production use."
          />
        </Scene>
      </Sequence>
      <Sequence from={180} durationInFrames={180}>
        <Scene>
          <div style={{ position: "absolute", left: 64, top: 54 }}>
            <SectionTitle eyebrow="LOCAL INFERENCE" title="本地模型工具正在形成新的部署层" accent={colorTokens.mint} />
          </div>
          <QuoteSourceCard
            frame={Math.max(0, frame - 180)}
            fps={fps}
            quote="同一个模型，可以根据隐私、成本与硬件条件选择不同的运行位置。"
            sourceName="Ollama"
            sourceRole="LOCAL MODEL RUNTIME"
            sourceKind="institution"
            sourceEntityId="brand.ollama"
            sourceEntityKind="ai"
            allowCandidateSource
            accent={colorTokens.mint}
          />
          <BilingualSubtitles
            zh="品牌标识由本地身份注册表统一解析"
            en="Brand identities are resolved through the local registry."
          />
        </Scene>
      </Sequence>
      <Sequence from={360} durationInFrames={180}>
        <Scene>
          <div style={{ position: "absolute", left: 64, top: 54 }}>
            <SectionTitle
              eyebrow="SOURCE CONTEXT"
              title="同一条信息需要区分机构、媒体与地区"
              accent={colorTokens.amber}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: 68,
              top: 255,
              width: 760,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
          >
            {[
              ["government.federal-reserve", "government", "政策机构"],
              ["media.reuters", "media", "新闻来源"],
              ["country.us", "country", "适用地区"],
            ].map(([id, kind, label]) => (
              <LiquidGlass key={id} padding="24px" radius={24} accent={`${colorTokens.amber}30`}>
                <IdentityMark
                  entityId={id}
                  kind={kind as "government" | "media" | "country"}
                  label={label}
                  size={68}
                  allowCandidate
                />
                <div style={{ marginTop: 18, fontSize: 23, fontWeight: 820 }}>{label}</div>
              </LiquidGlass>
            ))}
          </div>
          <BilingualSubtitles
            zh="语义类别决定使用哪一类身份资产"
            en="Semantic type determines which identity asset is used."
          />
        </Scene>
      </Sequence>
      <Sequence from={540} durationInFrames={180}>
        <MediaAssetConnectionReview />
      </Sequence>
    </AbsoluteFill>
  );
};
