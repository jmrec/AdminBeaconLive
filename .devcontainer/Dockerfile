FROM mcr.microsoft.com/devcontainers/javascript-node:22

ARG USERNAME=node

ENV APP_HOME=/workspace

RUN apt-get update && apt-get install -y \
    procps \
    git \
    sudo \
    && rm -rf /var/lib/apt/lists/* \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

RUN mkdir -p $APP_HOME /home/$USERNAME/.vscode-server/extensions /home/$USERNAME/.vscode-server/data \
    && chown -R $USERNAME:$USERNAME $APP_HOME /home/$USERNAME

WORKDIR $APP_HOME

USER $USERNAME

# RUN npm install -g nuxi pnpm

EXPOSE 3060