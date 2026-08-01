import { useState } from "react";
import { Form, useNavigation } from "react-router";
import {
  BankIcon,
  BellIcon,
  LockIcon,
  MailIcon,
  MobileMoneyIcon,
  WalletIcon,
} from "../../components/Icons";
import { ChoiceCards } from "../../components/ChoiceCards";
import { FormStatus } from "./FormStatus";
import { BANK_PROVIDERS, MOBILE_MONEY_PROVIDERS } from "./payout-providers";
import type {
  Account,
  NotificationPreferences,
  PayoutProfile,
  PortalActionResult,
} from "./types";

const PAYOUT_METHODS = [
  {
    value: "mobile_money",
    label: "Mobile money",
    hint: "Receive commission directly in your mobile wallet.",
    icon: <MobileMoneyIcon size={26} />,
  },
  {
    value: "bank",
    label: "Bank transfer",
    hint: "Send cleared commission to your bank account.",
    icon: <BankIcon size={26} />,
  },
];

const NOTIFICATIONS: {
  name: keyof NotificationPreferences;
  label: string;
  hint: string;
}[] = [
  {
    name: "conversion_emails",
    label: "New conversions",
    hint: "When a referral signs up or buys",
  },
  {
    name: "approval_emails",
    label: "Approvals",
    hint: "When commission clears the approval window",
  },
  {
    name: "reversal_emails",
    label: "Reversals",
    hint: "When a conversion is refunded or cancelled",
  },
  {
    name: "payout_emails",
    label: "Payouts",
    hint: "When a payout is sent to your account",
  },
];

// eslint-disable-next-line max-lines-per-function, complexity -- one settings screen: payout, notifications and password sections that share submit state; splitting them would thread that state through props for no gain
export function SettingsSection({
  profile,
  preferences,
  account,
  result,
}: {
  profile: PayoutProfile;
  preferences: NotificationPreferences;
  account: Account | null;
  result?: PortalActionResult;
}) {
  const navigation = useNavigation();
  const [payoutMethod, setPayoutMethod] = useState(
    profile.payout_method || "mobile_money",
  );
  const submittingIntent =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "")
      : "";

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Settings</h1>
          <p className="muted">
            Payout details, email notifications and account security.
          </p>
        </div>
      </div>

      {account ? (
        <section className="card account-card">
          <div className="account-identity">
            <span className="stat-label">Signed in as</span>
            <strong>{account.display_name}</strong>
            <span className="muted">{account.email}</span>
          </div>
          <div className="account-meta">
            <div>
              <span className="stat-label">Referral code</span>
              <strong>{account.code}</strong>
            </div>
            <div>
              <span className="stat-label">Status</span>
              <span className="pill pill-positive">{account.status}</span>
            </div>
          </div>
        </section>
      ) : null}

      <div className="settings-grid">
        <section className="card payout-settings-card">
          <div className="card-head">
            <span className="card-icon">
              <WalletIcon size={18} />
            </span>
            <div>
              <h2>Payout details</h2>
              <p className="muted">Where your cleared commission is sent.</p>
            </div>
          </div>

          {profile.masked_identifier ? (
            <p className="current-value">
              Currently paying to <strong>{profile.masked_identifier}</strong>
              {profile.provider_name ? ` · ${profile.provider_name}` : ""}
            </p>
          ) : (
            <p className="current-value muted">
              No payout account on file yet — add one to get paid.
            </p>
          )}

          <Form method="post" className="compact-form">
            <input type="hidden" name="intent" value="payout" />
            {/* A native <select> here rendered the OS dropdown, complete with
                a system-blue highlight that belongs to no part of this
                product. Two options do not need a dropdown at all. */}
            <ChoiceCards
              name="payout_method"
              legend="Payout method"
              defaultValue={profile.payout_method || "mobile_money"}
              choices={PAYOUT_METHODS}
              onChange={setPayoutMethod}
            />
            <label>
              Account name
              <input
                name="account_name"
                type="text"
                defaultValue={profile.account_name}
                placeholder="Name exactly as registered"
                required
              />
            </label>
            <ProviderAutocomplete
              key={payoutMethod}
              method={payoutMethod}
              defaultValue={
                payoutMethod === profile.payout_method
                  ? profile.provider_name
                  : ""
              }
            />
            <label>
              Account number
              <input
                name="account_identifier"
                type="text"
                placeholder="Momo number or account number"
                required
              />
            </label>
            <FormStatus intent="payout" result={result} />
            <button
              className="button"
              type="submit"
              disabled={submittingIntent === "payout"}
            >
              {submittingIntent === "payout"
                ? "Saving..."
                : "Save payout details"}
            </button>
          </Form>
        </section>

        <div className="settings-column">
          <section className="card">
            <div className="card-head">
              <span className="card-icon">
                <BellIcon size={18} />
              </span>
              <div>
                <h2>Email notifications</h2>
                <p className="muted">Choose what we email you about.</p>
              </div>
            </div>
            <Form method="post" className="compact-form">
              <input type="hidden" name="intent" value="notifications" />
              {NOTIFICATIONS.map((item) => (
                <label className="toggle-row" key={item.name}>
                  <input
                    type="checkbox"
                    name={item.name}
                    defaultChecked={preferences[item.name]}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <span className="muted">{item.hint}</span>
                  </span>
                </label>
              ))}
              <FormStatus intent="notifications" result={result} />
              <button
                className="button"
                type="submit"
                disabled={submittingIntent === "notifications"}
              >
                {submittingIntent === "notifications"
                  ? "Saving..."
                  : "Save preferences"}
              </button>
            </Form>
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-icon">
                <LockIcon size={18} />
              </span>
              <div>
                <h2>Password</h2>
                <p className="muted">
                  We email a secure link rather than changing it in the page.
                </p>
              </div>
            </div>
            <Form method="post" className="compact-form">
              <input type="hidden" name="intent" value="password" />
              {/* The address comes from the loaded account, not a field the
                  page can edit: a reset link must only ever go to the address
                  already on the account. */}
              <input
                type="hidden"
                name="account_email"
                value={account?.email ?? ""}
              />
              <p className="current-value">
                A reset link will be sent to{" "}
                <strong>{account?.email ?? "your account email"}</strong>.
              </p>
              <FormStatus intent="password" result={result} />
              <button
                className="button secondary-button"
                type="submit"
                disabled={!account?.email || submittingIntent === "password"}
              >
                {submittingIntent === "password"
                  ? "Sending..."
                  : "Send password reset link"}
                <MailIcon />
              </button>
            </Form>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProviderAutocomplete({
  method,
  defaultValue,
}: {
  method: string;
  defaultValue: string;
}) {
  const mobileMoney = method === "mobile_money";
  const options = mobileMoney ? MOBILE_MONEY_PROVIDERS : BANK_PROVIDERS;
  const listID = mobileMoney ? "mobile-money-providers" : "bank-providers";

  return (
    <label>
      {mobileMoney ? "Mobile money provider" : "Bank"}
      <input
        name="provider_name"
        type="text"
        list={listID}
        defaultValue={defaultValue}
        placeholder={
          mobileMoney ? "Search mobile money providers" : "Search banks"
        }
        autoComplete="off"
        required
      />
      <datalist id={listID}>
        {options.map((provider) => (
          <option value={provider} key={provider} />
        ))}
      </datalist>
      <span className="field-hint">
        Start typing, then choose a provider from the list.
      </span>
    </label>
  );
}
