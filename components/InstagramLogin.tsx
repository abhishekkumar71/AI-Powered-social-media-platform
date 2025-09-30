import React from "react";

const InstagramLogin = () => {
  const handleLogin = () => {
    const appId = process.env.NEXT_PUBLIC_APP_ID;
    const redirectUri = encodeURIComponent(
      process.env.NEXT_PUBLIC_REDIRECT_URL!
    );
    const scope =
      "instagram_basic,instagram_content_publish,pages_show_list,business_management";

    const loginUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;

    window.location.href = loginUrl;
  };

  return (
    <button onClick={handleLogin} className="btn btn-primary">
      Connect Instagram
    </button>
  );
};

export default InstagramLogin;
