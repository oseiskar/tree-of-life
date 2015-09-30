#include <iostream>
#include <sstream>
#include <string>
#include <stdexcept>
#include <list>
#include <vector>
#include <algorithm>
#include <numeric>

using std::list;
using std::string;
using std::runtime_error;

struct Tree {
    list<Tree> leaves;
    string name, name_prefix, name_id;
    int total_leaves, total_nodes;
    
    static int max_depth;
    static std::vector<int> pruned_sizes;
    static const int MAX_PRUNE_SIZE = 300000;
 
    void set_name(string name_) {
        name = name_;
        
        int uscore_pos = name.find_last_of('_');
        
        name_prefix = name.substr(0,uscore_pos);
        name_id = name.substr(uscore_pos+1);
    }
};

int Tree::max_depth;
std::vector<int> Tree::pruned_sizes;

string read_newick_string(std::istream &is) {
    std::ostringstream oss;
    while (true) {
        char c = is.peek();
        if (c == ',' || c == ')' || c == ';' || is.eof()) return oss.str();
        oss << c;
        is.ignore();
    }
    throw runtime_error("unexpected eof");
}

Tree read_newick_tree(std::istream &is, int depth = 0) {
    
    if (depth == 0) Tree::max_depth = 0;
    
    Tree tree;
    tree.total_leaves = 0;
    tree.total_nodes = 1;
    
    if (Tree::max_depth < depth) Tree::max_depth = depth;
    
    if (is.peek() == '(') {
        is.ignore();
        while (true) {
            Tree child = read_newick_tree(is, depth+1);
            tree.leaves.push_back(child);
            
            tree.total_leaves += child.total_leaves;
            tree.total_nodes += child.total_nodes;
            
            char c = is.get();
            if (c == ',') continue;
            if (c == ')') break;
            throw runtime_error("unexpected token "+string(1, c));
        }
    } else {
        tree.total_leaves = 1;
    }
    
    tree.set_name(read_newick_string(is));
    
    if (depth == 0 && is.peek() == ';') is.ignore();
    return tree;
}

void write_json_str(std::ostream &os, const string &str) {
    os << "\"";
    for (unsigned int i = 0; i < str.size(); ++i) {
        if (str[i] == '"') os << "\\\"";
        else os << str[i];
    }
    os << "\"";
}

void write_tree_json(const Tree& tree, std::ostream &os, bool root, int max_depth) {
    
    if (root) Tree::pruned_sizes = std::vector<int>();
    
    os << "{";
    const string &name = tree.name_prefix;
    
    if (name.size() > 0) {
        os << "\"n\":";
        write_json_str(os, name);
    }
    
    if (tree.leaves.size() > 0) {
        
        if (name.size() > 0) os << ',';
        
        os << "\"s\":" << tree.total_leaves;
        if (max_depth <= 0 && tree.total_nodes < Tree::MAX_PRUNE_SIZE) {
            Tree::pruned_sizes.push_back(tree.total_nodes);
        } else {
            os << ",\"c\":[";
            list<Tree>::const_iterator itr = tree.leaves.begin();
            while(itr != tree.leaves.end()) {
                write_tree_json(*itr, os, false, max_depth-1);
                itr++;
                if (itr != tree.leaves.end()) os << ',';
            }
            os << ']';
        }
    }
    os << '}';
    if (root) os << std::endl;
}

int main() {
    Tree tree = read_newick_tree(std::cin);
    std::cerr << tree.name << std::endl;
    std::cerr << tree.total_leaves << " leaf nodes" << std::endl;
    std::cerr << tree.total_nodes << " nodes" << std::endl;
    std::cerr << Tree::max_depth << " max depth" << std::endl;
    
    write_tree_json(tree, std::cout, true, 100000);
    
    const std::vector<int> p = Tree::pruned_sizes;
    std::cerr << p.size() << " trees pruned" << std::endl;
    if (p.size() > 0) {
        std::cerr << *std::max_element(p.begin(), p.end())
                  << " max pruned tree size"
                  << std::endl;
        std::cerr << std::accumulate(p.begin(), p.end(), 0)
                  << " nodes pruned"
                  << std::endl;
    }
}
