import type { Metadata } from "next";
import {
  LEGAL_ENTITY,
  LegalDocument,
  LegalSection,
  SupportEmail,
} from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy — Needle",
  description: "What Needle collects when you join a room, and what we do with it.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated="October 10, 2026">
      <LegalSection title="The short version">
        <p>
          {LEGAL_ENTITY} runs Needle, a live social music room. You show up,
          hear the same song as everyone else, take a turn on the decks, chat,
          and keep a profile of what you play and save.
        </p>
        <p>
          This policy describes what {LEGAL_ENTITY} collects on this site. It
          covers the account you create here and what happens inside a room.
          YouTube, Google, Apple, and your Fediverse server have their own
          policies.
        </p>
      </LegalSection>

      <LegalSection title="Information you give us">
        <p>
          You can sign in with Google, an email magic link, or a Fediverse
          handle. Apple sign-in is part of the product and appears only when it
          is turned on. Needle does not ask you to invent a password.
        </p>
        <p>
          Google or Apple sends the account details they share for sign-in,
          usually an email address, a name, and a profile image. A magic link
          uses the email address you type. A Fediverse sign-in stores your
          handle, such as name@server. The sign-in system also keeps a
          non-deliverable placeholder address so that account can exist. Your
          public profile does not show the placeholder, and a Fediverse account
          stays separate from a Google, Apple, or email account.
        </p>
        <p>
          Your profile holds a display name, an avatar image when a provider
          sent one, and an avatar color you can choose. You can change the name
          and the color.
        </p>
        <p>
          In the product we store the rooms you create (name, address,
          description, vibe, tags, and whether the room is private), the
          YouTube tracks you queue (title, artist when we have it, link,
          thumbnail, length, and who submitted it), your place on the decks or
          the waitlist, Awesome and Lame votes, tracks you save, chat you send,
          friend requests, blocks, and room invites.
        </p>
        <p>
          If you type an email on the home page, we use it only to open sign-up
          with that address filled in. It is not added to a mailing list.
        </p>
      </LegalSection>

      <LegalSection title="Information collected while you use Needle">
        <p>
          Session cookies keep you signed in. They are set in your browser by
          Supabase, which runs accounts and the database.
        </p>
        <p>
          A cookie named needle_auth_provider remembers which sign-in button
          you pressed, so an error can name that provider. It expires after
          about ten minutes.
        </p>
        <p>
          Fediverse sign-in sets a short-lived, HTTP-only cookie that holds the
          login attempt — your handle, the server, a one-time value, and where
          to send you next — until sign-in finishes or about ten minutes pass.
        </p>
        <p>
          We store when you joined a room and when you were last seen there, so
          the floor can show who is present. A mute choice for a room can sit
          in the browser&apos;s session storage for that tab. If you install
          Needle on your home screen, the browser may cache the files it needs
          to open the app.
        </p>
        <p>
          Vercel Analytics records anonymous site usage, such as which pages
          are visited. It is not used to build an advertising profile.
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          We use this information to run the rooms: shared playback, presence,
          chat, votes, badges and stats, friends, and invites.
        </p>
        <p>
          When an OpenAI key is configured, Needlebot may send a short snapshot
          of the room to OpenAI to write a host line. That snapshot can include
          the room name, vibe, recent track titles, the last few chat lines,
          listener count, vote counts, and a display name when someone just
          joined. When no key is configured, Needlebot uses lines written ahead
          of time and nothing is sent.
        </p>
        <p>
          Track search sends your search text to YouTube when a YouTube Data
          API key is configured. Playback uses the YouTube player embedded in
          the room. Google&apos;s policies cover what that player and that API
          collect.
        </p>
      </LegalSection>

      <LegalSection title="What other people can see">
        <p>
          Your display name, avatar, and Fediverse handle (if you signed in
          with one) can appear on your profile and in rooms you join. Chat,
          votes, the tracks you play, and your stats and badges are visible to
          people in that room or on your profile, depending on the feature.
        </p>
        <p>
          Friend relationships are visible to the people in them. A block is
          stored so the two of you are no longer connected as friends. It is
          not published as a public list. Chat in a room is visible to the
          people in that room. Private rooms are limited to people who can open
          them.
        </p>
        <p>We do not sell your personal information, and we do not run third-party ads.</p>
      </LegalSection>

      <LegalSection title="Who processes it">
        <p>
          The site is hosted on Vercel. Accounts, the database, and live
          updates run on Supabase. Sign-in may go through Google, Apple, or the
          Fediverse server you name. Search and playback go through YouTube.
          Needlebot, when it is enabled, goes through OpenAI. Those companies
          process information so the feature can work. We do not hand them your
          information for their own advertising.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Needle is for people 13 and older. We do not knowingly collect
          personal information from children under 13. If you believe a child
          under 13 has an account, email <SupportEmail /> and ask us to remove
          it.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Account and room data stay while the account exists and the rooms are
          still on the site. Signing out ends the session on that device. It
          does not delete your profile, chat, or tracks.
        </p>
        <p>
          There is no delete-account button yet. To ask for deletion, email{" "}
          <SupportEmail /> from the address on the account. Deletion removes
          the profile, stats, and saved tracks tied to you. Chat you already
          sent may remain in the room with your name detached.
        </p>
      </LegalSection>

      <LegalSection title="Changes and questions">
        <p>
          If this policy changes, the new version will be posted on this page
          and the date at the top will change. Questions go to <SupportEmail />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
