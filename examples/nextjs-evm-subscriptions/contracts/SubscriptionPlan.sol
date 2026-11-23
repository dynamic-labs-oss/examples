// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal slice of Uniswap's Permit2 AllowanceTransfer interface.
interface IAllowanceTransfer {
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    function permit(address owner, PermitSingle memory permitSingle, bytes calldata signature) external;

    function transferFrom(address from, address to, uint160 amount, address token) external;
}

/// @title SubscriptionPlan
/// @notice A cadence-enforcing Permit2 spender: the on-chain "subscription
///         delegation" for one fixed plan.
///
/// The plan's token, merchant, amount-per-pull and period are immutable, so a
/// subscriber's single signed Permit2 `PermitSingle` (spender = this contract)
/// binds all of them: the contract can only ever move `amount` of `token` to
/// `merchant`, once per `period`, and never more in total than the amount the
/// subscriber put in the permit.
///
/// `pull` is permissionless — anyone (a cron, the merchant, a keeper) may
/// trigger a due pull, but the money can only go to `merchant`.
///
/// Subscribers can revoke at any time by calling
/// `Permit2.approve(token, address(this), 0, 0)` from their own wallet.
contract SubscriptionPlan {
    IAllowanceTransfer public immutable permit2;
    address public immutable token;
    address public immutable merchant;
    uint160 public immutable amount;
    uint48 public immutable period;

    struct Subscription {
        uint48 start; // block.timestamp the permit was activated (0 = none)
        uint32 pulled; // pulls executed so far
    }

    mapping(address subscriber => Subscription) public subscriptions;

    event Subscribed(address indexed subscriber, uint48 start);
    event Pulled(address indexed subscriber, uint32 index, uint256 timestamp);

    error WrongSpender();
    error WrongToken();
    error NotSubscribed();
    error NotDue(uint48 dueAt);

    constructor(IAllowanceTransfer _permit2, address _token, address _merchant, uint160 _amount, uint48 _period) {
        require(_amount > 0 && _period > 0 && _merchant != address(0), "bad plan");
        permit2 = _permit2;
        token = _token;
        merchant = _merchant;
        amount = _amount;
        period = _period;
    }

    /// @notice Activate a subscription from the subscriber's signed Permit2
    ///         allowance. Callable by anyone (e.g. the app's relayer) — the
    ///         subscriber's signature is what authorizes it.
    ///         Re-subscribing restarts the schedule.
    function subscribe(address subscriber, IAllowanceTransfer.PermitSingle calldata permit, bytes calldata signature)
        external
    {
        if (permit.spender != address(this)) revert WrongSpender();
        if (permit.details.token != token) revert WrongToken();

        // Reverts unless `signature` is `subscriber`'s valid, unexpired,
        // correct-nonce signature over `permit`.
        permit2.permit(subscriber, permit, signature);

        subscriptions[subscriber] = Subscription({start: uint48(block.timestamp), pulled: 0});
        emit Subscribed(subscriber, uint48(block.timestamp));
    }

    /// @notice Timestamp the next pull becomes due (0 if not subscribed).
    function nextPullAt(address subscriber) public view returns (uint48) {
        Subscription memory s = subscriptions[subscriber];
        if (s.start == 0) return 0;
        return s.start + uint48(s.pulled) * period;
    }

    /// @notice Pull one period's payment from `subscriber` to the merchant.
    ///         Reverts if not yet due, or if the Permit2 allowance is
    ///         exhausted, expired or revoked.
    function pull(address subscriber) external {
        Subscription storage s = subscriptions[subscriber];
        if (s.start == 0) revert NotSubscribed();

        uint48 dueAt = s.start + uint48(s.pulled) * period;
        if (block.timestamp < dueAt) revert NotDue(dueAt);

        uint32 index = s.pulled;
        s.pulled = index + 1;

        permit2.transferFrom(subscriber, merchant, amount, token);
        emit Pulled(subscriber, index, block.timestamp);
    }
}
