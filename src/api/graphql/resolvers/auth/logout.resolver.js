import analytics from "~services/analytics";
import { Success } from "~helpers/response";
import { LOGGED_OUT } from "~helpers/constants/responseCodes";

export default {
  Mutation: {
    // Log out is idempotent
    async logout(
      _parent,
      { all },
      { cache, t, accessToken, jwt, clientId, clients }
    ) {
      if (accessToken) {
        const { sub } = jwt.decode(accessToken);

        // delete session
        if (all) {
          await Promise.all(
            clients.map((cid) => cache.remove(`${cid}:${sub}`))
          );
        } else {
          await cache.remove(`${clientId}:${sub}`);
        }
        analytics.track({
          userId: sub,
          event: "Logged Out",
        });
      }

      return Success({
        message: t(LOGGED_OUT),
        code: LOGGED_OUT,
      });
    },
  },
};
