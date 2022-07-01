import QueryError from "~utils/errors/QueryError";
import { Fail, Success } from "~helpers/response";
import {
  INVALID_LINK,
  PASSWORD_CHANGED,
} from "~helpers/constants/responseCodes";
import { PASSWORD_KEY_PREFIX } from "~helpers/constants/auth";
import analytics from "~services/analytics";
import { ACCOUNT_STATUS } from "~helpers/constants/models";

export default {
  Mutation: {
    async resetPassword(
      _parent,
      { input: { password, token } },
      { dataSources, cache, t, jwt, clients, clientId }
    ) {
      try {
        const { sub } = jwt.verify(token, { clientId });
        const key = `${PASSWORD_KEY_PREFIX}:${sub}`;
        const expectedToken = await cache.getAndDelete(key);

        if (token !== expectedToken) {
          // we can report suspicious activity here
          throw new QueryError(INVALID_LINK);
        }

        const { status } = await dataSources.users.findByPk(sub);

        if ([ACCOUNT_STATUS.BLOCKED].includes(status)) {
          throw new QueryError(status);
        }

        await dataSources.users.update(sub, {
          password,
          emailVerified: true,
          status: ACCOUNT_STATUS.ACTIVE,
        });

        // invalidate all refresh tokens
        await Promise.all(clients.map((cid) => cache.remove(`${cid}:${sub}`)));

        // we can send an email here to inform user of the change...

        analytics.track({
          userId: sub,
          event: "Reset Password",
        });

        return Success({
          message: t(PASSWORD_CHANGED),
          code: PASSWORD_CHANGED,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
          });
        }

        throw e;
      }
    },
  },
};
