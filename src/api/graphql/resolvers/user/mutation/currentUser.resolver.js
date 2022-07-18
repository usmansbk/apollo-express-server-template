import QueryError from "~utils/errors/QueryError";
import {
  INCORRECT_PASSWORD_ERROR,
  PASSWORD_UPDATED,
  PROFILE_UPDATED,
  SENT_SMS_OTP,
  INVALID_OTP,
  PHONE_NUMBER_VERIFIED,
} from "~helpers/constants/responseCodes";
import {
  PHONE_NUMBER_KEY_PREFIX,
  SMS_OTP_EXPIRES_IN,
} from "~helpers/constants/auth";
import { Fail, Success } from "~helpers/response";

export default {
  Mutation: {
    async updateCurrentUserFullname(
      _parent,
      { input },
      { currentUser, dataSources, t }
    ) {
      try {
        const user = await dataSources.users.update(currentUser.id, input);

        return Success({
          code: PROFILE_UPDATED,
          message: t(PROFILE_UPDATED),
          user,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
            errors: e.errors,
          });
        }
        throw e;
      }
    },
    async updateCurrentUserUsername(
      _parent,
      { username },
      { currentUser, dataSources, t }
    ) {
      try {
        const user = await dataSources.users.update(currentUser.id, {
          username,
        });

        return Success({
          code: PROFILE_UPDATED,
          message: t(PROFILE_UPDATED),
          user,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
            errors: e.errors,
          });
        }
        throw e;
      }
    },
    async updateCurrentUserLocale(
      _parent,
      { locale },
      { currentUser, t, dataSources }
    ) {
      try {
        const user = await dataSources.users.update(currentUser.id, { locale });

        return Success({
          code: PROFILE_UPDATED,
          message: t(PROFILE_UPDATED),
          user,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
            errors: e.errors,
          });
        }
        throw e;
      }
    },
    async updateCurrentUserTimeZone(
      _parent,
      { timezone },
      { currentUser, t, dataSources }
    ) {
      try {
        const user = await dataSources.users.update(currentUser.id, {
          timezone,
        });

        return Success({
          code: PROFILE_UPDATED,
          message: t(PROFILE_UPDATED),
          user,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
            errors: e.errors,
          });
        }
        throw e;
      }
    },
    async updateCurrentUserPassword(
      _parent,
      { input },
      { currentUser, t, dataSources }
    ) {
      try {
        const user = await dataSources.users.findByPk(currentUser.id);

        const granted = await user.checkPassword(input.oldPassword);

        if (!granted) {
          throw new QueryError(INCORRECT_PASSWORD_ERROR);
        }

        await dataSources.users.update(currentUser.id, {
          password: input.newPassword,
        });

        return Success({
          code: PASSWORD_UPDATED,
          message: t(PASSWORD_UPDATED),
          user,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
            errors: e.errors,
          });
        }
        throw e;
      }
    },
    async removeCurrentUserAvatar(
      _parent,
      _args,
      { currentUser, t, dataSources }
    ) {
      try {
        let user = await dataSources.users.findByPk(currentUser.id);
        const avatar = await user.getAvatar();
        if (avatar) {
          await dataSources.files.destroy(avatar.id);
        }
        if (user.socialAvatarURL) {
          user = await dataSources.users.update(user.id, {
            socialAvatarURL: null,
          });
        }

        return Success({ user });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
          });
        }
        throw e;
      }
    },
    async updateCurrentUserPhoneNumber(
      _parent,
      { phoneNumber },
      { currentUser, cache, t, otp, mailer, dataSources }
    ) {
      try {
        const user = await dataSources.users.update(currentUser.id, {
          phoneNumber,
        });

        if (phoneNumber) {
          const { id, phoneNumberVerified } = user;
          const key = `${PHONE_NUMBER_KEY_PREFIX}:${id}`;
          const sentToken = await cache.exists(key);

          if (!(sentToken || phoneNumberVerified)) {
            const token = otp.getNumberCode();

            await cache.set(key, token, SMS_OTP_EXPIRES_IN);

            mailer.sendSMS(token, phoneNumber);
          }
        }

        return Success({
          message: phoneNumber
            ? t(SENT_SMS_OTP, { phoneNumber })
            : t(PROFILE_UPDATED),
          code: phoneNumber ? SENT_SMS_OTP : PROFILE_UPDATED,
          user,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
            errors: e.errors,
          });
        }
        throw e;
      }
    },
    async verifyPhoneNumber(
      _parent,
      { token },
      { dataSources, cache, tokenInfo, t }
    ) {
      try {
        const { sub } = tokenInfo;
        const key = `${PHONE_NUMBER_KEY_PREFIX}:${sub}`;

        const expectedToken = await cache.getAndDelete(key);

        if (token !== expectedToken) {
          throw new QueryError(INVALID_OTP);
        }

        const user = await dataSources.users.update(sub, {
          phoneNumberVerified: true,
        });

        return Success({
          message: t(PHONE_NUMBER_VERIFIED),
          code: PHONE_NUMBER_VERIFIED,
          user,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
          });
        }

        throw e;
      }
    },
  },
};
