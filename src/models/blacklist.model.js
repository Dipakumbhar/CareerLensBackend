const mongoose = require("mongoose");

const blacklistSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: [true, "Token is required"],
            unique: true
        }
    },
    {
        timestamps: true
    }
);

// TTL index: MongoDB automatically removes blacklisted tokens after 24 hours,
// matching the JWT expiry of 1 day. This prevents the collection growing unboundedly.
blacklistSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const BlackListModel = mongoose.model("BlacklistTokens", blacklistSchema);

module.exports = BlackListModel;