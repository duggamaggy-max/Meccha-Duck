import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, addMoney } from '../../utils/economy.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// Only this Discord user ID can run /add money
const OWNER_ID = '1251810393425317930';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Owner-only admin commands')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('money')
                .setDescription("Add money to a user's wallet (owner only)")
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to give money to')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('How much money to add')
                        .setRequired(true)
                        .setMinValue(1)
                )
        ),
    category: 'Economy',

    execute: withErrorHandling(async (interaction, config, client) => {
        // Owner check runs before anything else
        if (interaction.user.id !== OWNER_ID) {
            logger.warn(`[ADMIN] Unauthorized /add money attempt by ${interaction.user.tag} (${interaction.user.id})`);
            await interaction.reply({
                embeds: [errorEmbed('Access Denied', 'Only the bot owner can use this command.')],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferred) return;

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guildId;

        if (targetUser.bot) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Invalid User', 'You cannot add money to a bot.')],
            });
            return;
        }

        const current = await getEconomyData(client, guildId, targetUser.id);
        if (!Number.isSafeInteger((current?.wallet || 0) + amount)) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Amount Too Large', 'That would push the wallet past the maximum balance.')],
            });
            return;
        }

        const result = await addMoney(client, guildId, targetUser.id, amount, 'wallet');

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    'Money Added',
                    `Added **$${amount.toLocaleString()}** to **${targetUser.username}**'s wallet.\n**New wallet balance:** $${result.newBalance.toLocaleString()}`
                ),
            ],
        });

        logger.info(`[ADMIN] ${interaction.user.tag} added $${amount} to ${targetUser.tag}'s wallet in guild ${guildId}`, {
            ownerId: interaction.user.id,
            targetId: targetUser.id,
            amount,
            newBalance: result.newBalance,
            guildId,
        });
    }, { command: 'add' }),
};
