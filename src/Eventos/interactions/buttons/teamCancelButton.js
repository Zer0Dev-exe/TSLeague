const { ActionRowBuilder } = require('discord.js')

const { checkTeamUserHasPerms } = require('../../../services/team.js')
const { findTeam } = require('../../../utils/team.js')

const { getTeamInfoEmbed } = require('../../../discord/embeds/team.js')
const { getErrorEmbed } = require('../../../discord/embeds/management.js')

const {
    getTeamLeftButton,
    getTeamChangeNameButton,
    getTeamChangeIconButton,
    getTeamChangeColorButton,
    getTeamManageMembersButton,
    getTeamReGenerateCodeButton
} = require('../../../discord/buttons/team.js')

module.exports = {
  customId: 'teamCancel',

  async execute(interaction) {
    try {
        const discordId = interaction.user.id
        const team = await findTeam({ discordId })
        const perms = await checkTeamUserHasPerms({ discordId })

        let components = []

        if (perms) {
            components.push(new ActionRowBuilder().addComponents(
                getTeamChangeNameButton(),
                getTeamChangeIconButton(),
                getTeamChangeColorButton(),
                getTeamManageMembersButton(),
                getTeamReGenerateCodeButton()
            ))
        }

        components.push(new ActionRowBuilder().addComponents(
            getTeamLeftButton()
        ))

        return interaction.update({
            embeds: [getTeamInfoEmbed({ team, perms })],
            components
        })
        } catch (error) {
        console.error(error)
        return interaction.reply({
            ephemeral: true,
            embeds: [getErrorEmbed({ error: error.message })]
      })
    }
  }
}