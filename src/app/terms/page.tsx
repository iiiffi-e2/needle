import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_ENTITY,
  LegalDocument,
  LegalSection,
  SupportEmail,
} from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Terms — Needle",
  description: "The rules for using Needle's live listening rooms.",
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms" updated="October 10, 2026">
      <LegalSection title="Agreement">
        <p>
          These terms are an agreement between you and {LEGAL_ENTITY} for
          Needle, the live listening rooms on this site. Creating an account or
          using a room means you agree to them and to the{" "}
          <Link href="/privacy" className="text-glow-soft hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          Needle lets people gather in a room, hear one shared YouTube
          playback, take turns as DJ, chat, react to tracks, save songs, and
          connect with friends. A room can be public or private.
        </p>
        <p>
          Features can change, pause, or go away. The service is free and is
          offered as it is. A room, a track, or a feature may stop working.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You need an account to take part. You can continue with Google, an
          email magic link, or a Fediverse handle. Use an account that belongs
          to you. You are responsible for what happens through it.
        </p>
        <p>
          A Fediverse sign-in stays its own account. It is not attached to a
          Google, Apple, or email account.
        </p>
      </LegalSection>

      <LegalSection title="What you post">
        <p>
          You keep the rights to the words you write: chat, room names,
          descriptions, and display names. You give Needle permission to store
          that content, show it to other people in the room, and keep it so the
          room still makes sense after you leave.
        </p>
        <p>
          You do not upload the music. You queue links to videos YouTube
          already hosts. You are responsible for the links you add. Queue and
          post only what you have the right to share, and follow YouTube&apos;s
          terms when you use their player and search.
        </p>
      </LegalSection>

      <LegalSection title="House rules">
        <p>
          Be a person other people can share a room with. Do not harass,
          threaten, or publish someone&apos;s private information. Do not post
          illegal content. Do not spam the chat or the decks. Do not try to
          break, scrape, or overload the service, or enter an account or a
          private room that is not yours. Do not pretend to be someone else in
          a way that misleads the room.
        </p>
        <p>
          We may remove content, close a room, or end an account that breaks
          these rules, including without notice when that protects people or
          the service.
        </p>
      </LegalSection>

      <LegalSection title="Other services in the room">
        <p>
          Playback and search depend on YouTube. Sign-in depends on Google,
          Apple, your email provider, or your Fediverse server. When Needlebot
          is turned on, it writes an occasional host line with OpenAI, or with
          lines written ahead of time. Those services have their own rules. A
          Needlebot line is a generated remark. It is not a statement of fact
          and it is not advice.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          Needle is a place to listen together. We do not control what people
          say in chat or which videos they queue. We are not responsible for
          third-party videos, for a playback interruption, or for a decision
          you make because of something you heard in a room.
        </p>
        <p>
          The service is provided &quot;as is&quot; and &quot;as available.&quot;
          To the extent the law allows, we disclaim warranties of
          merchantability, fitness for a particular purpose, and
          non-infringement.
        </p>
      </LegalSection>

      <LegalSection title="Limits on liability">
        <p>
          To the extent the law allows, {LEGAL_ENTITY} is not liable for
          indirect, incidental, special, or consequential damages, or for lost
          data or a room that ended early.
          If we are liable, the total is limited to the greater of what you
          paid us in the twelve months before the claim or fifty US dollars.
          Some places do not allow these limits. There, they apply only as far
          as the law allows.
        </p>
      </LegalSection>

      <LegalSection title="Stopping, changes, and the law that applies">
        <p>
          You can stop anytime and sign out from the menu. We can stop offering
          Needle, or stop offering it to you, at any time.
        </p>
        <p>
          We may update these terms by posting a new version on this page. The
          date at the top will change. If you keep using Needle after that, the
          new terms apply.
        </p>
        <p>
          These terms are governed by the laws that apply where {LEGAL_ENTITY}{" "}
          is formed, leaving conflict-of-law rules aside. If a court finds one
          part unenforceable, the rest stays in place.
        </p>
        <p>
          Questions about these terms go to <SupportEmail />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
