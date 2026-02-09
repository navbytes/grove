import type { Command } from 'commander';
import { GroveError } from '../../core/errors.js';

const ZSH_COMPLETION = `#compdef grove

_grove() {
  local -a commands
  commands=(
    'init:Interactive setup wizard for Grove'
    'config:Manage Grove configuration'
    'project:Manage registered projects'
    'new:Create a new task workspace'
    'list:List all tasks'
    'status:Show detailed status for a task'
    'open:Open a task workspace'
    'task:Manage projects within the current task'
    'archive:Archive a completed task'
    'delete:Permanently delete a task'
    'link:Manage links for the current task'
    'pr:Manage pull requests'
    'ci:Open CI status page'
    'jira:Jira integration commands'
    'refresh:Refresh PR and CI status'
    'watch:Watch mode with notifications'
    'context:Regenerate the .grove-context.md file'
    'notes:Open .grove-context.md in \\$EDITOR'
    'dashboard:Open full-screen TUI dashboard'
    'completion:Generate shell completion scripts'
  )

  _arguments -C \\
    '(-V --version)'{-V,--version}'[output the version number]' \\
    '(-h --help)'{-h,--help}'[display help for command]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case "$state" in
    command)
      _describe 'command' commands
      ;;
    args)
      case "$words[1]" in
        open|status|archive|delete)
          # Complete with task IDs
          local -a tasks
          if [ -f ~/.grove/tasks.json ]; then
            tasks=(\${(f)"$(node -e "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.grove/tasks.json','utf8')).forEach(x=>console.log(x.id))" 2>/dev/null)"})
          fi
          _describe 'task' tasks
          ;;
        project)
          local -a subcommands
          subcommands=('add:Register a project' 'list:List projects' 'remove:Remove a project' 'setup:Configure worktree setup')
          if [[ "\${words[2]}" == "remove" || "\${words[2]}" == "setup" ]]; then
            local -a projects
            if [ -f ~/.grove/projects.json ]; then
              projects=(\${(f)"$(node -e "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.grove/projects.json','utf8')).forEach(x=>console.log(x.name))" 2>/dev/null)"})
            fi
            _describe 'project' projects
          else
            _describe 'subcommand' subcommands
          fi
          ;;
        config)
          local -a subcommands
          subcommands=('get:Get a config value' 'set:Set a config value' 'edit:Open config in editor')
          _describe 'subcommand' subcommands
          ;;
        link)
          local -a subcommands
          subcommands=('add:Add a link' 'list:List links' 'open:Open a link' 'remove:Remove a link')
          _describe 'subcommand' subcommands
          ;;
        task)
          local -a subcommands
          subcommands=('add-project:Add a project to the task' 'remove-project:Remove a project from the task')
          _describe 'subcommand' subcommands
          ;;
        pr)
          local -a subcommands
          subcommands=('create:Create a pull request' 'status:Show PR/CI status' 'open:Open PR in browser')
          _describe 'subcommand' subcommands
          ;;
        jira)
          local -a subcommands
          subcommands=('open:Open Jira ticket in browser' 'status:Show Jira ticket status')
          _describe 'subcommand' subcommands
          ;;
        completion)
          local -a shells
          shells=('zsh' 'bash' 'fish')
          _describe 'shell' shells
          ;;
      esac
      ;;
  esac
}

_grove "$@"
`;

const BASH_COMPLETION = `_grove() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="init config project new list status open task archive delete link pr ci jira refresh watch context notes dashboard completion"

  case "\${prev}" in
    grove)
      COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
      return 0
      ;;
    open|status|archive|delete)
      if [ -f ~/.grove/tasks.json ]; then
        local tasks=$(node -e "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.grove/tasks.json','utf8')).forEach(x=>console.log(x.id))" 2>/dev/null)
        COMPREPLY=( $(compgen -W "\${tasks}" -- "\${cur}") )
      fi
      return 0
      ;;
    project)
      COMPREPLY=( $(compgen -W "add list remove setup" -- "\${cur}") )
      return 0
      ;;
    remove|setup)
      if [ "\${COMP_WORDS[1]}" = "project" ] && [ -f ~/.grove/projects.json ]; then
        local projects=$(node -e "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.grove/projects.json','utf8')).forEach(x=>console.log(x.name))" 2>/dev/null)
        COMPREPLY=( $(compgen -W "\${projects}" -- "\${cur}") )
      fi
      return 0
      ;;
    config)
      COMPREPLY=( $(compgen -W "get set edit" -- "\${cur}") )
      return 0
      ;;
    link)
      COMPREPLY=( $(compgen -W "add list open remove" -- "\${cur}") )
      return 0
      ;;
    task)
      COMPREPLY=( $(compgen -W "add-project remove-project" -- "\${cur}") )
      return 0
      ;;
    pr)
      COMPREPLY=( $(compgen -W "create status open" -- "\${cur}") )
      return 0
      ;;
    jira)
      COMPREPLY=( $(compgen -W "open status" -- "\${cur}") )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "zsh bash fish" -- "\${cur}") )
      return 0
      ;;
  esac
}

complete -F _grove grove
`;

const FISH_COMPLETION = `complete -c grove -n '__fish_use_subcommand' -a init -d 'Interactive setup wizard'
complete -c grove -n '__fish_use_subcommand' -a config -d 'Manage configuration'
complete -c grove -n '__fish_use_subcommand' -a project -d 'Manage projects'
complete -c grove -n '__fish_use_subcommand' -a new -d 'Create a new task'
complete -c grove -n '__fish_use_subcommand' -a list -d 'List all tasks'
complete -c grove -n '__fish_use_subcommand' -a status -d 'Show task status'
complete -c grove -n '__fish_use_subcommand' -a open -d 'Open a task workspace'
complete -c grove -n '__fish_use_subcommand' -a task -d 'Manage task projects'
complete -c grove -n '__fish_use_subcommand' -a archive -d 'Archive a task'
complete -c grove -n '__fish_use_subcommand' -a delete -d 'Delete a task'
complete -c grove -n '__fish_use_subcommand' -a link -d 'Manage task links'
complete -c grove -n '__fish_use_subcommand' -a pr -d 'Manage pull requests'
complete -c grove -n '__fish_use_subcommand' -a ci -d 'Open CI status page'
complete -c grove -n '__fish_use_subcommand' -a jira -d 'Jira integration'
complete -c grove -n '__fish_use_subcommand' -a refresh -d 'Refresh PR/CI status'
complete -c grove -n '__fish_use_subcommand' -a watch -d 'Watch mode with notifications'
complete -c grove -n '__fish_use_subcommand' -a context -d 'Regenerate context file'
complete -c grove -n '__fish_use_subcommand' -a notes -d 'Edit task notes'
complete -c grove -n '__fish_use_subcommand' -a dashboard -d 'Full-screen TUI dashboard'
complete -c grove -n '__fish_use_subcommand' -a completion -d 'Generate completions'

complete -c grove -n '__fish_seen_subcommand_from project' -a 'add list remove setup'
complete -c grove -n '__fish_seen_subcommand_from config' -a 'get set edit'
complete -c grove -n '__fish_seen_subcommand_from link' -a 'add list open remove'
complete -c grove -n '__fish_seen_subcommand_from task' -a 'add-project remove-project'
complete -c grove -n '__fish_seen_subcommand_from pr' -a 'create status open'
complete -c grove -n '__fish_seen_subcommand_from jira' -a 'open status'
complete -c grove -n '__fish_seen_subcommand_from completion' -a 'zsh bash fish'
`;

export function registerCompletionCommand(program: Command): void {
  program
    .command('completion [shell]')
    .description('Generate shell completion scripts (zsh, bash, fish)')
    .action((shell?: string) => {
      const target = shell || 'zsh';

      switch (target) {
        case 'zsh':
          process.stdout.write(ZSH_COMPLETION);
          break;
        case 'bash':
          process.stdout.write(BASH_COMPLETION);
          break;
        case 'fish':
          process.stdout.write(FISH_COMPLETION);
          break;
        default:
          throw new GroveError(`Unknown shell: ${target}. Supported: zsh, bash, fish`);
      }
    });
}
