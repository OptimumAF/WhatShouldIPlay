import { useEffect } from "react";

interface ProfileLike {
  id: string;
}

interface UseActiveProfileSelectionInput {
  accountProfiles: ProfileLike[];
  activeAccountProfileId: string;
  setActiveAccountProfileId: (value: string) => void;
}

export const useActiveProfileSelection = ({
  accountProfiles,
  activeAccountProfileId,
  setActiveAccountProfileId,
}: UseActiveProfileSelectionInput) => {
  useEffect(() => {
    if (accountProfiles.length === 0) {
      if (activeAccountProfileId) {
        setActiveAccountProfileId("");
      }
      return;
    }
    if (!activeAccountProfileId || !accountProfiles.some((profile) => profile.id === activeAccountProfileId)) {
      setActiveAccountProfileId(accountProfiles[0].id);
    }
  }, [accountProfiles, activeAccountProfileId, setActiveAccountProfileId]);
};
