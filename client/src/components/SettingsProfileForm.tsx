import { FormEvent, useEffect, useState } from "react";
import type { UserProfile } from "@xiaoelong/shared";
import { UserAvatar } from "./UserAvatar";

interface SettingsProfileFormProps {
  user: UserProfile;
  loading: boolean;
  error: string | null;
  saved: boolean;
  onSubmit: (payload: { nickname: string; avatarFile: File | null }) => Promise<void>;
}

export function SettingsProfileForm(props: SettingsProfileFormProps): JSX.Element {
  const [nickname, setNickname] = useState(props.user.nickname);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setNickname(props.user.nickname);
    setAvatarFile(null);
  }, [props.user.id, props.user.nickname, props.user.avatarUrl]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await props.onSubmit({
      nickname,
      avatarFile
    });
  }

  const hasChanges = nickname.trim() !== props.user.nickname || avatarFile !== null;
  const showSaved = props.saved && !props.error && !hasChanges;
  const saveLabel = props.loading ? "保存中" : showSaved ? "已保存" : "保存资料";

  return (
    <form className="settings-profile-form" onSubmit={handleSubmit}>
      <div className="settings-profile-main">
        <div className="settings-profile-preview">
          {avatarPreviewUrl ? (
            <img src={avatarPreviewUrl} alt="" draggable={false} />
          ) : (
            <UserAvatar
              user={props.user}
              className="settings-profile-avatar"
              fallbackClassName="settings-profile-avatar settings-profile-avatar-fallback"
            />
          )}
        </div>

        <label className="settings-profile-field">
          昵称
          <input
            type="text"
            value={nickname}
            maxLength={32}
            required
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
      </div>

      <label className="settings-avatar-picker">
        <input
          className="file-input"
          type="file"
          accept="image/*"
          onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
        />
        <span className="file-upload-control settings-file-control">
          <span className="file-upload-button">选择头像</span>
          <span className="file-upload-name">{avatarFile ? avatarFile.name : "沿用当前头像"}</span>
        </span>
      </label>

      {props.error ? <p className="error-text settings-profile-message">{props.error}</p> : null}
      <button type="submit" className="primary-soft-button settings-profile-save" disabled={props.loading || !hasChanges}>
        {saveLabel}
      </button>
    </form>
  );
}
