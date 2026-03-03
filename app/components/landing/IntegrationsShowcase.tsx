/**
 * INTEGRATIONS SHOWCASE
 *
 * Prominent display of 67+ Composio app integrations with brand logos.
 * Animated marquee of top brands + categorized grid.
 */

'use client';

import { useState } from 'react';
import Section, { SectionHeader } from './Section';

// ============================================================
// Brand SVG Icons — official paths for recognizable platforms
// ============================================================

const BrandIcon = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 ${className}`}>
    {children}
  </svg>
);

const BRAND_ICONS: Record<string, React.ReactNode> = {
  github: (
    <BrandIcon>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </BrandIcon>
  ),
  slack: (
    <BrandIcon>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </BrandIcon>
  ),
  stripe: (
    <BrandIcon>
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-7.076-2.19l-.9 5.555C5.505 22.88 8.57 24 12.102 24c2.58 0 4.711-.636 6.256-1.828 1.652-1.275 2.46-3.182 2.46-5.543 0-4.098-2.509-5.825-6.842-7.479z" />
    </BrandIcon>
  ),
  google: (
    <BrandIcon>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </BrandIcon>
  ),
  notion: (
    <BrandIcon>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.27 2.122c-.42-.326-.98-.7-2.055-.607L3.01 2.795c-.467.047-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.726l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM1.936 1.035l13.87-1.026c1.681-.14 2.1.093 2.8.607l3.876 2.704c.467.326.607.747.607 1.213v16.378c0 1.026-.373 1.632-1.681 1.726l-15.458.933c-.98.047-1.448-.093-1.962-.747L.946 18.97c-.56-.747-.793-1.306-.793-1.96V2.667c0-.84.374-1.54 1.783-1.632z" />
    </BrandIcon>
  ),
  salesforce: (
    <BrandIcon>
      <path d="M10.005 4.538a4.326 4.326 0 0 1 3.497-1.803c1.69 0 3.168.961 3.903 2.376a5.078 5.078 0 0 1 2.081-.444c2.833 0 5.127 2.317 5.127 5.176 0 2.858-2.294 5.175-5.127 5.175a5.1 5.1 0 0 1-1.179-.138 3.886 3.886 0 0 1-3.542 2.296c-.459 0-.9-.08-1.31-.228a4.573 4.573 0 0 1-4.145 2.67 4.573 4.573 0 0 1-4.133-2.63 3.625 3.625 0 0 1-.705.069C2.33 17.057 0 14.706 0 11.832c0-1.874.988-3.516 2.468-4.427A4.235 4.235 0 0 1 2.1 5.565c0-2.39 1.92-4.327 4.29-4.327a4.28 4.28 0 0 1 3.615 1.3z" />
    </BrandIcon>
  ),
  hubspot: (
    <BrandIcon>
      <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.984v-.066A2.2 2.2 0 0 0 17.23.833h-.066a2.2 2.2 0 0 0-2.2 2.2v.067c0 .86.5 1.6 1.222 1.96V7.93a5.363 5.363 0 0 0-2.553 1.281l-6.784-5.28a2.443 2.443 0 0 0 .072-.553 2.378 2.378 0 1 0-2.378 2.378c.376 0 .726-.112 1.025-.296l6.676 5.196a5.387 5.387 0 0 0-.457 2.161 5.43 5.43 0 0 0 .561 2.399l-2.06 2.06a2.085 2.085 0 0 0-.638-.108 2.108 2.108 0 1 0 2.108 2.108c0-.224-.04-.438-.108-.638l2.028-2.028a5.399 5.399 0 1 0 4.236-8.68z" />
    </BrandIcon>
  ),
  shopify: (
    <BrandIcon>
      <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104zm-1.469-17.953c0 0-.301.093-.769.24-.459-1.327-1.272-2.549-2.706-2.549-.039 0-.079.001-.118.003-.399-.528-.893-.76-1.33-.76-3.292 0-4.878 4.119-5.369 6.217-.632.196-1.081.335-1.137.353-.354.111-.365.122-.412.456-.036.254-1.178 9.074-1.178 9.074l9.537 1.79 3.482-.824zm-3.692-2.259c-.382.118-.805.25-1.259.39.244-.945.704-1.889 1.268-2.507.211-.232.506-.487.844-.655-.226.793-.54 1.777-.853 2.772zm1.462-3.563c.549.002.888.255 1.158.562-1.096.517-2.27 1.819-2.764 4.421-.366.113-.724.224-1.058.327.498-2.124 1.677-5.31 2.664-5.31z" />
    </BrandIcon>
  ),
  discord: (
    <BrandIcon>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </BrandIcon>
  ),
  twitter: (
    <BrandIcon>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </BrandIcon>
  ),
  linkedin: (
    <BrandIcon>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </BrandIcon>
  ),
  jira: (
    <BrandIcon>
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24.013 12.5V1.005A1.005 1.005 0 0 0 23.013 0z" />
    </BrandIcon>
  ),
  figma: (
    <BrandIcon>
      <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z" />
    </BrandIcon>
  ),
  youtube: (
    <BrandIcon>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </BrandIcon>
  ),
  instagram: (
    <BrandIcon>
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 1 1-2.882 0 1.441 1.441 0 0 1 2.882 0z" />
    </BrandIcon>
  ),
  zendesk: (
    <BrandIcon>
      <path d="M11.085 0v16.534L0 24V7.466zm1.83 7.466L24 0v16.534L12.915 24z" />
    </BrandIcon>
  ),
};

// Text-based icon fallback for brands without SVGs
const TextIcon = ({ letter, color }: { letter: string; color: string }) => (
  <div
    className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white ${color}`}
  >
    {letter}
  </div>
);

// ============================================================
// Integration Data — 67 real Composio toolkits
// ============================================================

interface Integration {
  name: string;
  icon: React.ReactNode;
  category: string;
}

const CATEGORIES = [
  'All',
  'Communication',
  'Development',
  'Productivity',
  'CRM & Sales',
  'Social Media',
  'Finance',
  'Marketing',
  'Design',
  'Support',
] as const;

// Top-tier integrations shown in the animated marquee
const MARQUEE_BRANDS: { name: string; icon: React.ReactNode; color: string }[] = [
  { name: 'GitHub', icon: BRAND_ICONS.github, color: 'text-white' },
  { name: 'Slack', icon: BRAND_ICONS.slack, color: 'text-[#E01E5A]' },
  { name: 'Stripe', icon: BRAND_ICONS.stripe, color: 'text-[#635BFF]' },
  { name: 'Google', icon: BRAND_ICONS.google, color: 'text-[#4285F4]' },
  { name: 'Notion', icon: BRAND_ICONS.notion, color: 'text-white' },
  { name: 'Salesforce', icon: BRAND_ICONS.salesforce, color: 'text-[#00A1E0]' },
  { name: 'HubSpot', icon: BRAND_ICONS.hubspot, color: 'text-[#FF7A59]' },
  { name: 'Shopify', icon: BRAND_ICONS.shopify, color: 'text-[#96BF48]' },
  { name: 'Discord', icon: BRAND_ICONS.discord, color: 'text-[#5865F2]' },
  { name: 'Jira', icon: BRAND_ICONS.jira, color: 'text-[#0052CC]' },
  { name: 'Figma', icon: BRAND_ICONS.figma, color: 'text-[#F24E1E]' },
  { name: 'YouTube', icon: BRAND_ICONS.youtube, color: 'text-[#FF0000]' },
  { name: 'LinkedIn', icon: BRAND_ICONS.linkedin, color: 'text-[#0A66C2]' },
  { name: 'X / Twitter', icon: BRAND_ICONS.twitter, color: 'text-white' },
  { name: 'Instagram', icon: BRAND_ICONS.instagram, color: 'text-[#E4405F]' },
  { name: 'Zendesk', icon: BRAND_ICONS.zendesk, color: 'text-[#03363D]' },
];

// Full categorized list
const ALL_INTEGRATIONS: Integration[] = [
  // Communication
  { name: 'Slack', icon: BRAND_ICONS.slack, category: 'Communication' },
  { name: 'Discord', icon: BRAND_ICONS.discord, category: 'Communication' },
  {
    name: 'MS Teams',
    icon: <TextIcon letter="T" color="bg-[#6264A7]" />,
    category: 'Communication',
  },
  {
    name: 'Telegram',
    icon: <TextIcon letter="T" color="bg-[#0088CC]" />,
    category: 'Communication',
  },
  {
    name: 'WhatsApp',
    icon: <TextIcon letter="W" color="bg-[#25D366]" />,
    category: 'Communication',
  },
  { name: 'Twilio', icon: <TextIcon letter="T" color="bg-[#F22F46]" />, category: 'Communication' },
  {
    name: 'Intercom',
    icon: <TextIcon letter="I" color="bg-[#1F8DED]" />,
    category: 'Communication',
  },
  // Development
  { name: 'GitHub', icon: BRAND_ICONS.github, category: 'Development' },
  { name: 'GitLab', icon: <TextIcon letter="G" color="bg-[#FC6D26]" />, category: 'Development' },
  {
    name: 'Bitbucket',
    icon: <TextIcon letter="B" color="bg-[#0052CC]" />,
    category: 'Development',
  },
  { name: 'Sentry', icon: <TextIcon letter="S" color="bg-[#362D59]" />, category: 'Development' },
  { name: 'Vercel', icon: <TextIcon letter="V" color="bg-black" />, category: 'Development' },
  { name: 'Linear', icon: <TextIcon letter="L" color="bg-[#5E6AD2]" />, category: 'Development' },
  {
    name: 'Cloudflare',
    icon: <TextIcon letter="C" color="bg-[#F38020]" />,
    category: 'Development',
  },
  { name: 'Supabase', icon: <TextIcon letter="S" color="bg-[#3ECF8E]" />, category: 'Development' },
  // Productivity
  { name: 'Notion', icon: BRAND_ICONS.notion, category: 'Productivity' },
  { name: 'Google Drive', icon: BRAND_ICONS.google, category: 'Productivity' },
  { name: 'Google Docs', icon: BRAND_ICONS.google, category: 'Productivity' },
  { name: 'Google Sheets', icon: BRAND_ICONS.google, category: 'Productivity' },
  { name: 'Google Slides', icon: BRAND_ICONS.google, category: 'Productivity' },
  { name: 'Google Calendar', icon: BRAND_ICONS.google, category: 'Productivity' },
  { name: 'Google Meet', icon: BRAND_ICONS.google, category: 'Productivity' },
  { name: 'Google Tasks', icon: BRAND_ICONS.google, category: 'Productivity' },
  { name: 'Gmail', icon: BRAND_ICONS.google, category: 'Productivity' },
  {
    name: 'Confluence',
    icon: <TextIcon letter="C" color="bg-[#172B4D]" />,
    category: 'Productivity',
  },
  {
    name: 'Evernote',
    icon: <TextIcon letter="E" color="bg-[#00A82D]" />,
    category: 'Productivity',
  },
  { name: 'Box', icon: <TextIcon letter="B" color="bg-[#0061D5]" />, category: 'Productivity' },
  { name: 'Dropbox', icon: <TextIcon letter="D" color="bg-[#0061FF]" />, category: 'Productivity' },
  { name: 'Outlook', icon: <TextIcon letter="O" color="bg-[#0078D4]" />, category: 'Productivity' },
  {
    name: 'Calendly',
    icon: <TextIcon letter="C" color="bg-[#006BFF]" />,
    category: 'Productivity',
  },
  {
    name: 'Airtable',
    icon: <TextIcon letter="A" color="bg-[#18BFFF]" />,
    category: 'Productivity',
  },
  // CRM & Sales
  { name: 'Salesforce', icon: BRAND_ICONS.salesforce, category: 'CRM & Sales' },
  { name: 'HubSpot', icon: BRAND_ICONS.hubspot, category: 'CRM & Sales' },
  {
    name: 'Pipedrive',
    icon: <TextIcon letter="P" color="bg-[#017737]" />,
    category: 'CRM & Sales',
  },
  {
    name: 'Monday.com',
    icon: <TextIcon letter="M" color="bg-[#FF3D57]" />,
    category: 'CRM & Sales',
  },
  { name: 'Jira', icon: BRAND_ICONS.jira, category: 'CRM & Sales' },
  { name: 'Asana', icon: <TextIcon letter="A" color="bg-[#F06A6A]" />, category: 'CRM & Sales' },
  { name: 'ClickUp', icon: <TextIcon letter="C" color="bg-[#7B68EE]" />, category: 'CRM & Sales' },
  { name: 'Trello', icon: <TextIcon letter="T" color="bg-[#0052CC]" />, category: 'CRM & Sales' },
  { name: 'Todoist', icon: <TextIcon letter="T" color="bg-[#E44332]" />, category: 'CRM & Sales' },
  // Social Media
  { name: 'X / Twitter', icon: BRAND_ICONS.twitter, category: 'Social Media' },
  { name: 'LinkedIn', icon: BRAND_ICONS.linkedin, category: 'Social Media' },
  { name: 'Instagram', icon: BRAND_ICONS.instagram, category: 'Social Media' },
  { name: 'YouTube', icon: BRAND_ICONS.youtube, category: 'Social Media' },
  { name: 'Reddit', icon: <TextIcon letter="R" color="bg-[#FF4500]" />, category: 'Social Media' },
  { name: 'Loom', icon: <TextIcon letter="L" color="bg-[#625DF5]" />, category: 'Social Media' },
  // Finance
  { name: 'Stripe', icon: BRAND_ICONS.stripe, category: 'Finance' },
  { name: 'Shopify', icon: BRAND_ICONS.shopify, category: 'Finance' },
  { name: 'QuickBooks', icon: <TextIcon letter="Q" color="bg-[#2CA01C]" />, category: 'Finance' },
  { name: 'DocuSign', icon: <TextIcon letter="D" color="bg-[#FFCD00]" />, category: 'Finance' },
  // Marketing
  { name: 'Google Ads', icon: BRAND_ICONS.google, category: 'Marketing' },
  { name: 'Google Analytics', icon: BRAND_ICONS.google, category: 'Marketing' },
  { name: 'Google Search Console', icon: BRAND_ICONS.google, category: 'Marketing' },
  { name: 'Mailchimp', icon: <TextIcon letter="M" color="bg-[#FFE01B]" />, category: 'Marketing' },
  { name: 'SendGrid', icon: <TextIcon letter="S" color="bg-[#1A82E2]" />, category: 'Marketing' },
  { name: 'Webflow', icon: <TextIcon letter="W" color="bg-[#4353FF]" />, category: 'Marketing' },
  { name: 'Typeform', icon: <TextIcon letter="T" color="bg-[#262627]" />, category: 'Marketing' },
  // Design
  { name: 'Figma', icon: BRAND_ICONS.figma, category: 'Design' },
  { name: 'Google Photos', icon: BRAND_ICONS.google, category: 'Design' },
  { name: 'Google Maps', icon: BRAND_ICONS.google, category: 'Design' },
  // Support
  { name: 'Zendesk', icon: BRAND_ICONS.zendesk, category: 'Support' },
  { name: 'Freshdesk', icon: <TextIcon letter="F" color="bg-[#25C16F]" />, category: 'Support' },
  { name: 'PagerDuty', icon: <TextIcon letter="P" color="bg-[#06AC38]" />, category: 'Support' },
  // AI & Voice
  {
    name: 'ElevenLabs',
    icon: <TextIcon letter="11" color="bg-black" />,
    category: 'Communication',
  },
  {
    name: 'Perplexity',
    icon: <TextIcon letter="P" color="bg-[#1FB8CD]" />,
    category: 'Development',
  },
  { name: 'SerpAPI', icon: <TextIcon letter="S" color="bg-[#0FA873]" />, category: 'Development' },
];

// ============================================================
// Component
// ============================================================

export default function IntegrationsShowcase() {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filtered =
    activeCategory === 'All'
      ? ALL_INTEGRATIONS
      : ALL_INTEGRATIONS.filter((i) => i.category === activeCategory);

  return (
    <Section padding="lg" className="overflow-hidden">
      <SectionHeader
        badge="67+ Integrations"
        badgeColor="purple"
        title="Connect to Every App Your Team Uses"
        description="Powered by Composio. Automate workflows across 67+ apps — from Slack to Salesforce, GitHub to Google Suite. Your AI agent connects to the tools you already use."
      />

      {/* Animated Brand Marquee */}
      <div className="relative mb-16">
        {/* Gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

        {/* Scrolling row */}
        <div className="flex animate-marquee gap-8">
          {[...MARQUEE_BRANDS, ...MARQUEE_BRANDS].map((brand, i) => (
            <div
              key={`${brand.name}-${i}`}
              className="flex items-center gap-3 shrink-0 bg-slate-900/50 rounded-xl px-5 py-3 border border-slate-800 hover:border-purple-500/30 transition-all"
            >
              <div className={brand.color}>{brand.icon}</div>
              <span className="text-sm font-medium text-slate-300 whitespace-nowrap">
                {brand.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? 'bg-purple-600 text-white'
                : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-800 hover:border-purple-500/30'
            }`}
          >
            {cat}
            {cat !== 'All' && (
              <span className="ml-1.5 text-xs opacity-60">
                ({ALL_INTEGRATIONS.filter((i) => i.category === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-w-6xl mx-auto mb-12">
        {filtered.map((integration, i) => (
          <div
            key={`${integration.name}-${i}`}
            className="group flex items-center gap-2.5 bg-slate-900/50 rounded-xl px-3 py-3 border border-slate-800 hover:border-purple-500/30 hover:bg-slate-800/50 transition-all"
          >
            <div className="shrink-0">{integration.icon}</div>
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate">
              {integration.name}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom stat */}
      <div className="text-center">
        <p className="text-slate-500 text-sm">
          Powered by <span className="text-purple-400 font-semibold">Composio</span> &mdash; the
          leading integration platform for AI agents. All 67+ integrations are real,
          production-ready, and available today.
        </p>
      </div>
    </Section>
  );
}
