FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# 换 apt 源（阿里云）
RUN sed -i 's@archive.ubuntu.com@mirrors.aliyun.com@g; s@security.ubuntu.com@mirrors.aliyun.com@g' /etc/apt/sources.list

RUN apt update && apt install -y \
    build-essential \
    curl \
    wget \
    git \
    pkg-config \
    libgtk-3-dev \
    libgtk-4-dev \
    libglib2.0-dev \
    libgtksourceview-5-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libwebkit2gtk-4.1-dev \
    libjavascriptcoregtk-4.1-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt install -y nodejs && \
    npm install -g npm@latest

# Install Rust toolchain
ENV RUSTUP_DIST_SERVER=https://mirrors.ustc.edu.cn/rust-static
ENV RUSTUP_UPDATE_ROOT=https://mirrors.ustc.edu.cn/rust-static/rustup
RUN curl https://mirrors.ustc.edu.cn/rust-static/rustup/rustup-init.sh -sSf \
        | sh -s -- -y --profile minimal \
   && echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> /root/.bashrc
ENV PATH="/root/.cargo/bin:${PATH}"


WORKDIR /workspace

COPY . /workspace

RUN npm install --registry=https://registry.npmmirror.com

CMD ["/bin/bash"]
